import { volumeValue, siteInfo, volumeScriptId } from './volume-core.mjs';
let creating;
let updating = Promise.resolve();
async function audio(operation, data = {}) {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL('features/volume-offscreen.html')] });
  if (!contexts.length) {
    if (operation !== 'start' && operation !== 'prepare') return { ok: true, active: false };
    creating ??= chrome.offscreen.createDocument({ url: 'features/volume-offscreen.html', reasons: ['USER_MEDIA'], justification: 'Play the user-selected tab audio through its volume gain, without recording or uploading.' }).finally(() => { creating = null; });
    await creating;
  }
  if (operation === 'prepare') return { ok: true };
  const result = await chrome.runtime.sendMessage({ target: 'volume-offscreen', operation, ...data });
  if (!result?.ok) throw new Error(result?.error || 'Audio output did not respond');
  return result;
}
async function preferences() { return (await chrome.storage.local.get({ volumeSites: {} })).volumeSites; }
async function notify(tabId) { try { await chrome.tabs.sendMessage(tabId, { type: 'volume-refresh' }); } catch { /* Page script may not be loaded yet. */ } }
async function apply(message) {
  const tab = await chrome.tabs.get(message.tabId), site = siteInfo(tab.url);
  if (site.origin !== message.origin) throw new Error('The tab changed sites; reopen the popup');
  const percent = volumeValue(message.percent), sites = await preferences();
  const previous = sites[site.origin] ?? 100;
  const before = await audio('status', { tabId: tab.id });
  let started = false;
  try {
    const id = volumeScriptId(site.pattern);
    if (!(await chrome.scripting.getRegisteredContentScripts({ ids: [id] })).length) await chrome.scripting.registerContentScripts([{ id, matches: [site.pattern], js: ['features/volume-page.js'], allFrames: true, runAt: 'document_start', persistAcrossSessions: true }]);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['features/volume-page.js'] });
    if (percent > 100 && !before.active) {
      await audio('prepare');
      await audio('start', { tabId: tab.id, percent, streamId: await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }) });
      started = true;
    } else if (before.active) await audio('set', { tabId: tab.id, percent });
    if (siteInfo((await chrome.tabs.get(tab.id)).url).origin !== site.origin) throw new Error('The tab changed sites; reopen the popup');
    await chrome.storage.local.set({ volumeSites: { ...sites, [site.origin]: percent } });
    await notify(tab.id);
    return { ok: true, percent, active: percent > 100 || before.active };
  } catch (error) {
    if (started) await audio('stop', { tabId: tab.id });
    else if (before.active) await audio('set', { tabId: tab.id, percent: before.percent ?? previous });
    await notify(tab.id);
    throw error;
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.target === 'volume-offscreen') return;
  const popup = sender.url === chrome.runtime.getURL('popup.html');
  let task;
  if (message?.type === 'volume-query' && (popup || sender.tab)) {
    const tabId = popup ? message.tabId : sender.tab.id;
    task = Promise.all([audio('status', { tabId }), preferences()]).then(([status, sites]) => ({ ok: true, active: status.active, sites }));
  } else if (message?.type === 'volume-apply' && popup) task = updating = updating.catch(() => {}).then(() => apply(message));
  else if (message?.type === 'volume-stop' && popup) task = audio('stop', { tabId: message.tabId }).then(async result => { await notify(message.tabId); return result; });
  else return;
  task.then(respond).catch(error => respond({ ok: false, error: error.message }));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => { void audio('stop', { tabId }).catch(() => {}); });
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (!change.url) return;
  void (async () => {
    const active = await audio('status', { tabId });
    if (!active.active) return;
    let percent = 100;
    try { percent = (await preferences())[siteInfo(change.url || tab.url).origin] ?? 100; } catch { /* Internal pages use native volume. */ }
    await audio('set', { tabId, percent });
    await notify(tabId);
  })().catch(error => console.warn('KarmoLab volume:', error.message));
});
