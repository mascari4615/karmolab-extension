import { siteInfo } from './volume-core.mjs';
const button = document.getElementById('darkModeSite'), status = document.getElementById('darkModeStatus');
const msg = key => chrome.i18n.getMessage(key);
let tab, site, enabled = false;
async function render() {
  button.disabled = true;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    site = siteInfo(tab.url);
    const { darkModeSites = [] } = await chrome.storage.local.get('darkModeSites');
    enabled = darkModeSites.includes(site.pattern) && await chrome.permissions.contains({ origins: [site.pattern] });
    status.textContent = site.host + ': ' + msg(enabled ? 'darkModeOn' : 'darkModeOff');
    button.textContent = msg(enabled ? 'darkModeDisable' : 'darkModeEnable');
    button.disabled = false;
  } catch { status.textContent = msg('darkModeUnsupported'); }
}
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    if (!enabled && !await chrome.permissions.request({ origins: [site.pattern] })) { status.textContent = msg('darkModeDenied'); return; }
    const result = await chrome.runtime.sendMessage({ type: 'dark-mode-apply', tabId: tab.id, pattern: site.pattern, enabled: !enabled });
    if (!result?.ok) throw new Error(result?.error || 'Dark mode unavailable');
    await render();
    if (result.reloadNeeded) status.textContent += ' ' + msg('darkModeReload');
  } catch { status.textContent = msg('darkModeError'); }
  finally { button.disabled = false; }
});
void render();
