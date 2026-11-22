import './density-core.js';
import './settings-backup.js';
import { createKeywordSync } from './keyword-sync.mjs';
import { createBlockSync } from './block-sync.mjs';

const sync = createKeywordSync(chrome.storage);
const blocks = createBlockSync(chrome.storage);
globalThis.KarmoKeywordSync = sync;
const store = globalThis.KarmoBlockStore;
const ready = () => store.apply({ op: 'migrateKeywords' });
const receive = () => store.exclusive(sync.receive);
let blockTimer;
const syncBlocks = () => store.exclusive(async () => {
  try { await blocks.run(); }
  catch (error) { await chrome.storage.local.set({ blockSyncError: error.message }); }
});
function scheduleBlocks() {
  clearTimeout(blockTimer);
  blockTimer = setTimeout(() => syncBlocks().catch(console.warn), 350);
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && sync.changed(changes)) receive().catch(() => {});
  if ((area === 'sync' && blocks.remoteChanged(changes)) ||
      (area === 'local' && blocks.localChanged(changes))) scheduleBlocks();
});
ready().then(receive).catch(console.warn);
scheduleBlocks();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const action = message?.type;
  if (sender.id !== chrome.runtime.id) return false;
  const popup = sender.url?.split('#')[0] === chrome.runtime.getURL('popup.html');
  const youtube = sender.url === chrome.runtime.getURL('features/youtube-settings.html');
  let run;
  if (action === 'karmolab.keywords.ready' && popup) run = ready().then(receive);
  if (action === 'karmolab.keywords.save' && popup) {
    run = receive().then(() => store.apply({ op: 'keywordReplace', words: message.words, autoWords: message.autoWords, base: message.base }));
  }
  if (action === 'karmolab.keywords.sync' && popup) {
    run = ready().then(() => store.exclusive(() => sync.toggle(message.enabled === true))).then(scheduleBlocks);
  }
  if (action === 'karmolab.keywords.blockSync' && popup) {
    run = store.exclusive(async () => {
      if (!message.enabled) return blocks.disable();
      if (!(await chrome.storage.local.get('keywordSyncEnabled')).keywordSyncEnabled) throw Error('브라우저 동기화를 먼저 켜세요.');
      return blocks.run(true);
    });
  }
  if (action === 'karmolab.keywords.retryBlocks' && popup) run = syncBlocks();
  if (action === 'karmolab.backup.restore' && youtube) {
    const storage = { local: {
      get: keys => chrome.storage.local.get(keys),
      set: sync.commit,
      remove: keys => chrome.storage.local.remove(keys)
    }, sync: chrome.storage.sync };
    run = ready().then(() => store.exclusive(() => globalThis.KarmoSettingsBackup.restore(message.backup, storage)));
  }
  if (!run) return false;
  run.then(() => respond({ ok: true }), error => respond({ ok: false, partial: error.partial, error: error.message }));
  return true;
});

