for (const el of document.querySelectorAll("[data-msg]")) {
  el.textContent = chrome.i18n.getMessage(el.dataset.msg);
}

const box = document.getElementById("shortsDate");
chrome.storage.sync.get({ shortsDate: true }, (v) => { box.checked = v.shortsDate !== false; });
box.addEventListener("change", () => chrome.storage.sync.set({ shortsDate: box.checked }));

const blockBox = document.getElementById('userBlock');
const list = document.getElementById('blockedList');
const status = document.getElementById('blockStatus');
const message = key => chrome.i18n.getMessage(key);
async function renderBlocks() {
  try {
    const values = await chrome.storage.local.get(null);
    blockBox.checked = values.userBlock !== false;
    blockBox.disabled = false;
    list.replaceChildren();
    const entries = Object.entries(values).filter(([key, value]) => key.startsWith('blockedChannel:') && value?.ids);
    status.textContent = message(entries.length ? 'blockLocalHint' : 'blockEmpty');
    for (const [key, person] of entries.sort((a, b) => (b[1].created || 0) - (a[1].created || 0))) {
      const row = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = person.name;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = message('unblockUser');
      button.setAttribute('aria-label', message('unblockUser') + ': ' + person.name);
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await chrome.storage.local.remove(key);
          await renderBlocks();
          blockBox.focus();
        } catch {
          button.disabled = false;
          status.textContent = message('blockSaveError');
        }
      });
      row.append(name, button);
      list.append(row);
    }
  } catch { status.textContent = message('blockLoadError'); }
}
blockBox.addEventListener('change', async () => {
  blockBox.disabled = true;
  try { await chrome.storage.local.set({ userBlock: blockBox.checked }); }
  catch { blockBox.checked = !blockBox.checked; status.textContent = message('blockSaveError'); }
  finally { blockBox.disabled = false; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && Object.keys(changes).some(key => key === 'userBlock' || key.startsWith('blockedChannel:'))) renderBlocks();
});
renderBlocks();

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
      // YouTube's required permission is shared by the existing features.
      if (base64Pattern !== 'https://www.youtube.com/*') await chrome.permissions.remove({ origins: [base64Pattern] });
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

const countBox = document.getElementById('shortsCount');
const countMode = document.getElementById('shortsCountMode');
const watchTimeBox = document.getElementById('shortsWatchTime');
const countStatus = document.getElementById('shortsCountStatus');
chrome.storage.local.get({ shortsCount: true, shortsCountMode: 'both', shortsWatchTime: true }).then(values => {
  countBox.checked = values.shortsCount !== false;
  countMode.value = values.shortsCountMode;
  watchTimeBox.checked = values.shortsWatchTime !== false;
  countBox.disabled = countMode.disabled = watchTimeBox.disabled = false;
}).catch(() => { countStatus.textContent = message('shortsCountError'); });
for (const control of [countBox, countMode, watchTimeBox]) control.addEventListener('change', async () => {
  control.disabled = true;
  try {
    await chrome.storage.local.set({ shortsCount: countBox.checked, shortsCountMode: countMode.value, shortsWatchTime: watchTimeBox.checked });
    countStatus.textContent = '';
  } catch {
    countStatus.textContent = message('shortsCountError');
    const values = await chrome.storage.local.get({ shortsCount: true, shortsCountMode: 'both', shortsWatchTime: true }).catch(() => null);
    if (values) { countBox.checked = values.shortsCount !== false; countMode.value = values.shortsCountMode; watchTimeBox.checked = values.shortsWatchTime !== false; }
  } finally { control.disabled = false; }
});
