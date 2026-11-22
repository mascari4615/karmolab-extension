import './features/keyword-core.js';
import './features/arca/block-store.js';
import './features/keyword-background.mjs';
import { createBlockSync } from './features/block-sync.mjs';

const extensionId = 'jeejnajjlpdepjaelmahdlialbhcfbed';
const host = 'com.karmolab.sync_probe';
const alarm = 'karmolab-sync-probe';
const fixture = 'karmolab_sync_probe_jeejnajj';
const youtube = 'blockedChannel:@' + fixture;
const store = globalThis.KarmoBlockStore;
const blocks = createBlockSync(chrome.storage);
let running = false;

async function apply(action) {
  if (action === 'observe') return;
  if (action === 'prepare') {
    await store.exclusive(async () => {
      const flags = await chrome.storage.local.get(['keywordSyncEnabled', 'blockSyncEnabled']);
      if (!flags.keywordSyncEnabled) await KarmoKeywordSync.toggle(true);
      if (!flags.blockSyncEnabled) await blocks.run(true);
    });
    return;
  }
  const { keywordSyncEnabled, blockSyncEnabled } = await chrome.storage.local.get(['keywordSyncEnabled', 'blockSyncEnabled']);
  if (!keywordSyncEnabled || !blockSyncEnabled) throw Error('Prepare both sync areas first.');
  const add = action === 'add';
  if (add) {
    const data = await chrome.storage.local.get(['keywordWords', 'keywordAutoBlockWords', youtube]);
    const { keywordWords = [], keywordAutoBlockWords = [] } = data;
    if (!keywordWords.includes(fixture)) {
      await store.apply({ op: 'keywordReplace', words: [...keywordWords, fixture], autoWords: keywordAutoBlockWords });
    }
    if (!data[youtube]) await chrome.storage.local.set({ [youtube]: { name: fixture, ids: ['@' + fixture], created: Date.now() } });
  } else {
    await store.apply({ op: 'keywordRemove', word: fixture });
    await chrome.storage.local.remove(youtube);
  }
  const { blocklist = {} } = await chrome.storage.local.get('blocklist');
  for (const site of ['arca', 'dcinside']) {
    if (Boolean(blocklist[site]?.[fixture]) !== add) {
      await store.apply({ site, op: add ? 'block' : 'remove', key: fixture, name: fixture });
    }
  }
  await store.apply({ site: 'dcinside', op: add ? 'channelAdd' : 'channelRemove', channel: fixture });
  await store.exclusive(() => blocks.run());
}

async function snapshot() {
  const data = await chrome.storage.local.get(['keywordWords', youtube, 'blocklist', 'karmoSettings', 'keywordSyncEnabled', 'blockSyncEnabled', 'blockSyncError']);
  return {
    keyword: (data.keywordWords || []).includes(fixture),
    youtube: Boolean(data[youtube]),
    arca: Boolean(data.blocklist?.arca?.[fixture]),
    dc: Boolean(data.blocklist?.dcinside?.[fixture]),
    gallery: (data.karmoSettings?.dcinside?.blockedChannels || []).includes(fixture),
    ready: data.keywordSyncEnabled === true && data.blockSyncEnabled === true,
    syncError: Boolean(data.blockSyncError)
  };
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const command = await chrome.runtime.sendNativeMessage(host, { type: 'poll' });
    if (!['prepare', 'observe', 'add', 'remove'].includes(command?.action) ||
        !/^[0-9a-f-]{36}$/.test(command.id)) return;
    const { syncProbeAck } = await chrome.storage.local.get('syncProbeAck');
    let ok = true;
    if (syncProbeAck !== command.id) {
      try {
        await apply(command.action);
        await chrome.storage.local.set({ syncProbeAck: command.id });
      } catch { ok = false; }
    }
    await chrome.runtime.sendNativeMessage(host, { type: 'receipt', id: command.id, ok, ...await snapshot() });
  } catch (error) {
    console.warn('KarmoLab sync probe:', error.message);
  } finally { running = false; }
}

if (chrome.runtime.id === extensionId) {
  const start = () => {
    void chrome.alarms.create(alarm, { periodInMinutes: 0.5 });
    void tick();
  };
  chrome.runtime.onInstalled.addListener(start);
  chrome.runtime.onStartup.addListener(start);
  chrome.alarms.onAlarm.addListener(event => { if (event.name === alarm) void tick(); });
  start();
}
