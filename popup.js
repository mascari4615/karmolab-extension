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
  if (area === 'local') renderBlocks();
});
renderBlocks();
