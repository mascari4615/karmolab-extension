import '../keyword-core.js';
import './block-store.js';


const SCRIPT = 'karmolab-arca';
const ORIGIN = 'https://arca.live/*';
const ROOT = 'features/arca/';
let tail = Promise.resolve();
const serial = (fn) => { const run = tail.then(fn); tail = run.catch(() => {}); return run; };
const settings = async () => (await chrome.storage.local.get('arcaFeature')).arcaFeature || {};
const popup = (sender) => sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup.html');
async function register() {
  const enabled = (await settings()).enabled && await chrome.permissions.contains({ origins: [ORIGIN] });
  const found = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT] });
  if (!enabled && found.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT] });
  if (enabled && !found.length) await chrome.scripting.registerContentScripts([{ id: SCRIPT, matches: [ORIGIN], js: [ROOT + 'entry.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
}
async function enable() {
  if (!await chrome.permissions.contains({ origins: [ORIGIN] })) throw new Error('아카라이브 사이트 접근을 허용해 주세요.');
  const current = await settings();
  const state = { ...current, enabled: true, at: current.at || Date.now() };
  await chrome.storage.local.set({ arcaFeature: state });
  try { await register(); }
  catch (error) { await chrome.storage.local.set({ arcaFeature: current }); throw error; }
  return state;
}
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !msg?.type?.startsWith('arca.')) return false;
  const action = async () => {
    if (msg.type === 'arca.feature.status') return { state: await settings(), permission: await chrome.permissions.contains({ origins: [ORIGIN] }) };
    if (msg.type === 'arca.feature.enable' || msg.type === 'arca.feature.disable') {
      if (!popup(sender)) throw new Error('팝업에서 변경하세요.');
      if (msg.type.endsWith('enable')) return { state: await enable() };
      await chrome.storage.local.set({ arcaFeature: { ...await settings(), enabled: false } });
      await register(); return {};
    }
    if (!(await settings()).enabled) throw new Error('KarmoLab 팝업에서 아카라이브 기능을 먼저 켜세요.');
    if (msg.type === 'arca.canRun') return {};
    if (msg.type === 'arca.block.mutate') {
      if (msg.command?.site && msg.command.site !== 'arca') throw new Error('아카라이브만 지원합니다.');
      const command = { ...msg.command, site: 'arca' };
      if (command.op === 'import') command.data = Object.fromEntries(['block', 'like', 'settings'].map(key => [key, { arca: command.data?.[key]?.arca || {} }]));
      return globalThis.KarmoBlockStore.apply(command);
    }
    if (msg.type === 'arca.liked.open' || msg.type === 'arca.settings.open') {
      if (msg.type === 'arca.settings.open') {
        await chrome.storage.session.set({ panelSection:'arca' });
        try { await chrome.action.openPopup(sender.tab ? { windowId:sender.tab.windowId } : {}); }
        catch { throw new Error('브라우저 오른쪽 위 KarmoLab 확장 아이콘을 눌러 아카라이브 설정을 여세요.'); }
        return {};
      }
      await chrome.tabs.create({ url: chrome.runtime.getURL(ROOT + (msg.type === 'arca.liked.open' ? 'arca-liked.html' : 'options.html')) }); return {};
    }
    throw new Error('지원하지 않는 아카라이브 요청');
  };
  serial(action).then(value => respond({ ok: true, ...value }), error => respond({ ok: false, error: error.message }));
  return true;
});
chrome.permissions.onRemoved.addListener(() => { register().catch(console.error); });
const recover = () => serial(async () => {
  await globalThis.KarmoBlockStore.apply({ op: 'migrateKeywords' });
  await register();
}).catch(console.error);
chrome.runtime.onStartup.addListener(recover);
chrome.runtime.onInstalled.addListener(recover);
recover();
