for (const el of document.querySelectorAll('[data-msg]')) el.textContent = chrome.i18n.getMessage(el.dataset.msg);
const message = key => chrome.i18n.getMessage(key);
const base64Button = document.getElementById('base64Site');
const base64Status = document.getElementById('base64Status');
let base64Tab;
let base64Pattern;
let base64Active = false;
const base64ScriptId = pattern => 'base64-' + Array.from(new TextEncoder().encode(pattern), b => b.toString(16).padStart(2, '0')).join('');

async function renderBase64() {
  try {
    [base64Tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(base64Tab.url);
    if (!['http:', 'https:'].includes(url.protocol) || ['chromewebstore.google.com', 'microsoftedge.microsoft.com'].includes(url.hostname)) throw new Error('Unsupported page');
    base64Pattern = `${url.protocol}//${url.hostname}/*`;
    const sites = (await chrome.storage.local.get({ base64Sites: [] })).base64Sites;
    base64Active = sites.includes(base64Pattern) && await chrome.permissions.contains({ origins: [base64Pattern] });
    base64Status.textContent = url.hostname + ': ' + message(base64Active ? 'base64On' : 'base64Off');
    base64Button.textContent = message(base64Active ? 'base64Disable' : 'base64Enable');
    base64Button.disabled = false;
  } catch {
    base64Status.textContent = message('base64Unsupported');
    base64Button.disabled = true;
  }
}
base64Button.addEventListener('click', async () => {
  base64Button.disabled = true;
  try {
    // Keep request inside the click gesture, before any unrelated await.
    if (!base64Active && !await chrome.permissions.request({ origins: [base64Pattern] })) {
      base64Status.textContent = message('base64Denied');
      return;
    }
    const { base64Sites = [] } = await chrome.storage.local.get('base64Sites');
    const id = base64ScriptId(base64Pattern);
    if (base64Active) {
      if ((await chrome.scripting.getRegisteredContentScripts({ ids: [id] })).length) await chrome.scripting.unregisterContentScripts({ ids: [id] });
      await chrome.storage.local.set({ base64Sites: base64Sites.filter(site => site !== base64Pattern) });
      // Volume memory and YouTube may still need this shared host permission.
      const otherFeatureUsesSite = (await chrome.scripting.getRegisteredContentScripts()).some(script => script.matches.includes(base64Pattern));
      if (base64Pattern !== 'https://www.youtube.com/*' && !otherFeatureUsesSite) await chrome.permissions.remove({ origins: [base64Pattern] });
    } else {
      const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
      if (!registered.length) await chrome.scripting.registerContentScripts([{
        id, matches: [base64Pattern], js: ['features/base64-core.js', 'features/base64-links.js'],
        css: ['features/base64-links.css'], runAt: 'document_idle', persistAcrossSessions: true,
      }]);
      await chrome.storage.local.set({ base64Sites: [...new Set([...base64Sites, base64Pattern])] });
      const target = { tabId: base64Tab.id };
      await chrome.scripting.insertCSS({ target, files: ['features/base64-links.css'] });
      await chrome.scripting.executeScript({ target, files: ['features/base64-core.js', 'features/base64-links.js'] });
    }
    await renderBase64();
  } catch { base64Status.textContent = message('base64Error'); }
  finally { base64Button.disabled = false; }
});
renderBase64();
