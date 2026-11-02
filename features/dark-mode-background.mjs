import { siteInfo } from './volume-core.mjs';
export const darkScriptId = pattern => 'dark-' + Array.from(new TextEncoder().encode(pattern), byte => byte.toString(16).padStart(2, '0')).join('');
let updating = Promise.resolve();
async function apply(message) {
  const tab = await chrome.tabs.get(message.tabId), site = siteInfo(tab.url);
  if (site.pattern !== message.pattern || typeof message.enabled !== 'boolean') throw new Error('The tab changed sites; reopen the popup');
  if (message.enabled && !await chrome.permissions.contains({ origins: [site.pattern] })) throw new Error('Site permission required');
  const { darkModeSites = [] } = await chrome.storage.local.get('darkModeSites');
  const id = darkScriptId(site.pattern);
  const previous = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  const script = { id, matches: [site.pattern], js: ['features/vendor/darkreader.js', 'features/dark-mode-page.js'], runAt: 'document_start', persistAcrossSessions: true };
  try {
    if (message.enabled && !previous.length) await chrome.scripting.registerContentScripts([script]);
    else if (!message.enabled && previous.length) await chrome.scripting.unregisterContentScripts({ ids: [id] });
    const latest = siteInfo((await chrome.tabs.get(tab.id)).url);
    if (latest.pattern !== site.pattern) throw new Error('The tab changed sites; reopen the popup');
    await chrome.storage.local.set({ darkModeSites: message.enabled ? [...new Set([...darkModeSites, site.pattern])] : darkModeSites.filter(value => value !== site.pattern) });
  } catch (error) {
    if (message.enabled && !previous.length) await chrome.scripting.unregisterContentScripts({ ids: [id] });
    else if (!message.enabled && previous.length) await chrome.scripting.registerContentScripts(previous);
    throw error;
  }
  // Existing pages receive storage changes; inject only where the engine is absent.
  const tabs = await chrome.tabs.query({ url: site.pattern });
  const results = await Promise.allSettled(tabs.map(async target => {
    if (message.enabled) {
      const [state] = await chrome.scripting.executeScript({ target: { tabId: target.id }, func: () => Boolean(globalThis.karmoDarkMode) });
      if (!state.result) await chrome.scripting.executeScript({ target: { tabId: target.id }, files: script.js });
    } else await chrome.scripting.executeScript({ target: { tabId: target.id }, func: () => globalThis.karmoDarkMode?.refresh() });
  }));
  return { ok: true, enabled: message.enabled, reloadNeeded: results.some(result => result.status === 'rejected') };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html') || message?.type !== 'dark-mode-apply') return;
  updating = updating.catch(() => {}).then(() => apply(message));
  updating.then(respond).catch(error => respond({ ok: false, error: error.message }));
  return true;
});
