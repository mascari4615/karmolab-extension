import { buildDigest } from './build.mjs';

const ALARM = 'karmolab-local-reload';
const PENDING = 'karmolabLocalReloadPending';
const boot = crypto.randomUUID();
let busy = false;
let status;

async function initialize() {
  const self = await chrome.management.getSelf();
  if (self.installType !== 'development') return null;
  const read = async file => {
    const response = await fetch(chrome.runtime.getURL(file), { cache: 'no-store' });
    if (!response.ok) throw new Error(`Cannot read ${file}`);
    return new Uint8Array(await response.arrayBuffer());
  };
  const manifest = JSON.parse(new TextDecoder().decode(await read('manifest.json')));
  const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  const build = await buildDigest(manifest, read, digest);
  const pending = (await chrome.storage.local.get(PENDING))[PENDING];
  let completed = '';
  if (pending) {
    const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
    const results = await Promise.allSettled(tabs.map(tab => chrome.tabs.reload(tab.id)));
    if (results.some(result => result.status === 'rejected')) throw new Error('YouTube refresh failed');
    await chrome.storage.local.remove(PENDING);
    completed = pending;
  }
  return { id: chrome.runtime.id, boot, build, completed };
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    status ??= initialize().catch(error => { status = undefined; throw error; });
    const info = await status;
    if (!info) return;
    const response = await fetch('http://127.0.0.1:17379/karmolab/reload?' + new URLSearchParams(info), {
      cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(4000),
      headers: { 'X-KarmoLab-Reload': '1' },
    });
    if (!response.ok) return;
    const command = await response.json();
    if (command.action !== 'reload' || !/^[a-f0-9-]{36}$/.test(command.nonce || '')) return;
    await chrome.storage.local.set({ [PENDING]: command.nonce });
    chrome.runtime.reload();
  } catch (error) {
    // 로컬 명령 서버 미실행은 정상 대기 상태
    if (error.name !== 'TypeError' && error.name !== 'TimeoutError') console.warn('KarmoLab reload:', error.message);
  } finally { busy = false; }
}

chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) void tick(); });
chrome.runtime.onStartup.addListener(() => { void chrome.alarms.create(ALARM, { periodInMinutes: 0.5 }); void tick(); });
chrome.runtime.onInstalled.addListener(() => { void chrome.alarms.create(ALARM, { periodInMinutes: 0.5 }); void tick(); });
void chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
void tick();
