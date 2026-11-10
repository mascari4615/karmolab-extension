(() => {
  const prefix = 'keywordAutoBlockAllow:';
  globalThis.KarmoAutoBlockExceptions = {
    create() {
      const host = document.createElement('section'); host.id = 'kl-auto-block-exceptions';
      const title = document.createElement('h3'), search = document.createElement('input'), list = document.createElement('ul'), status = document.createElement('p');
      title.textContent = chrome.i18n.getMessage('autoBlockExceptions');
      search.type = 'search'; search.placeholder = title.textContent; search.setAttribute('aria-label', title.textContent);
      search.style.cssText = 'box-sizing:border-box;width:100%;padding:8px;background:transparent;color:inherit;border:1px solid #777;font:inherit';
      list.style.cssText = 'max-height:200px;overflow:auto'; status.setAttribute('role','status'); host.append(title, search, list, status);
      let records = {}, revision = 0;
      const pending = new Set();
      function render() {
        list.replaceChildren(); const term = KarmoKeywords.normalize(search.value);
        for (const [key, value] of Object.entries(records).filter(([key,value]) => key.startsWith(prefix) && value)) {
          const id = key.slice(prefix.length), name = typeof value.name === 'string' ? value.name : id;
          if (!KarmoKeywords.normalize(name + ' ' + id).includes(term)) continue;
          const row = document.createElement('li'), label = document.createElement('span'), button = document.createElement('button');
          label.textContent = name; label.title = id; button.type = 'button'; button.disabled = pending.has(key);
          KarmoControlIcons.apply(button, 'retry', chrome.i18n.getMessage('autoBlockResume') + ': ' + name);
          button.addEventListener('click', async () => {
            pending.add(key); render();
            try { await chrome.storage.local.remove(key); delete records[key]; status.textContent = chrome.i18n.getMessage('panelSaved'); }
            catch { status.textContent = chrome.i18n.getMessage('panelSaveError'); }
            finally { pending.delete(key); render(); search.focus(); }
          }); row.append(label, button); list.append(row);
        }
        if (!list.children.length) { const empty = document.createElement('li'); empty.textContent = chrome.i18n.getMessage('autoBlockExceptionsEmpty'); list.append(empty); }
      }
      async function load() {
        const version = ++revision;
        try { const values = await chrome.storage.local.get(null); if (version !== revision) return; records = values; render(); }
        catch { status.textContent = chrome.i18n.getMessage('panelLoadError'); }
      }
      search.addEventListener('input',render);
      chrome.storage.onChanged.addListener((changes,area) => { if (area === 'local' && Object.keys(changes).some(key => key.startsWith(prefix))) void load(); });
      void load(); return host;
    },
  };
})();
