import './transfer.js';
import './block-store.js';

const SOURCE = 'lojdjbbekohhajlefkklkfoddldpheom';
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
async function peer(message) {
  try { return await chrome.runtime.sendMessage(SOURCE, message); }
  catch (error) {
    if (/Receiving end does not exist|Could not establish connection/.test(error.message)) return null;
    throw error;
  }
}
async function enable() {
  if (!await chrome.permissions.contains({ origins: [ORIGIN] })) throw new Error('아카라이브 사이트 접근을 허용해 주세요.');
  const current = await settings();
  if (current.enabled) { await register(); return current; }
  if (current.at) {
    const state = { ...current, enabled: true };
    await chrome.storage.local.set({ arcaFeature: state });
    try { await register(); } catch (error) { await chrome.storage.local.set({ arcaFeature: current }); throw error; }
    return state;
  }
  let preparation;
  let target;
  let changedKeys = [];
  const recoveryJournal = (await chrome.storage.local.get('arcaMigrationJournal')).arcaMigrationJournal;
  let journal;
  try {
    await chrome.storage.local.set({ arcaFeature: { ...current, initializing: true } });
    preparation = await peer({ type: 'arca.transfer.prepare' });
    if (!preparation && (recoveryJournal || current.initializing)) throw new Error('Dev 연결을 복구한 뒤 아카라이브를 다시 켜세요. 이전 데이터는 보존되어 있습니다.');
    if (preparation && !preparation.ok) throw new Error(preparation.error || 'Dev 데이터 준비 실패');
    if (preparation) {
      target = await chrome.storage.local.get(null);
      journal = target.arcaMigrationJournal;
      if (journal) {
        Object.assign(target, journal.before);
        for (const key of journal.added) delete target[key];
      }
      const data = globalThis.KarmoArcaTransfer.select(preparation.data);
      const merged = globalThis.KarmoArcaTransfer.merge(data, target);
      changedKeys = Object.keys(merged);
      journal ||= { before: {}, added: [] };
      for (const key of changedKeys) {
        if (Object.hasOwn(journal.before, key) || journal.added.includes(key)) continue;
        if (Object.hasOwn(target, key)) journal.before[key] = target[key];
        else journal.added.push(key);
      }
      await chrome.storage.local.set({ arcaMigrationJournal: journal });
      await chrome.storage.local.set({ ...merged, arcaMigrationBackup: { at: Date.now(), source: SOURCE, keys: changedKeys } });
      const result = await peer({ type: 'arca.transfer.commit', token: preparation.token });
      if (!result?.ok) throw new Error(result?.error || 'Dev 전환 응답 없음');
    }
    const state = { enabled: true, migrated: !!preparation, at: Date.now() };
    await chrome.storage.local.set({ arcaFeature: state });
    await register();
    await chrome.storage.local.remove('arcaMigrationJournal');
    return state;
  } catch (error) {
    try {
      if (journal) {
        await chrome.storage.local.set(journal.before);
        await chrome.storage.local.remove(journal.added);
      }
      await chrome.storage.local.set({ arcaFeature: { ...current, initializing: true, enabled: false } });
      await register().catch(console.error);
    } finally {
      if (preparation?.token) {
        const cancelled = await peer({ type: 'arca.transfer.cancel', token: preparation.token });
        if (!cancelled?.ok) throw new Error(`${error.message} 전환 확인이 필요합니다. 다시 켜면 보존된 데이터로 복구합니다.`);
      }
    }
    if ((!recoveryJournal && !current.initializing) || preparation?.token) {
      await chrome.storage.local.set({ arcaFeature: { ...current, initializing: false, enabled: false } });
      await chrome.storage.local.remove('arcaMigrationJournal');
    }
    throw error;
  }
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
      await chrome.tabs.create({ url: chrome.runtime.getURL(ROOT + (msg.type === 'arca.liked.open' ? 'arca-liked.html' : 'options.html')) }); return {};
    }
    throw new Error('지원하지 않는 아카라이브 요청');
  };
  serial(action).then(value => respond({ ok: true, ...value }), error => respond({ ok: false, error: error.message }));
  return true;
});
chrome.permissions.onRemoved.addListener(() => { register().catch(console.error); });
const recover = () => serial(async () => {
  const state = await settings();
  if (state.initializing) return enable();
  await register();
  if (state.enabled) await chrome.storage.local.remove('arcaMigrationJournal');
}).catch(console.error);
chrome.runtime.onStartup.addListener(recover);
chrome.runtime.onInstalled.addListener(recover);
recover();
