(() => {
  if (globalThis.karmoDarkMode) { globalThis.karmoDarkMode.refresh(); return; }
  const pattern = `${location.protocol}//${location.hostname}/*`;
  let revision = 0;
  async function refresh() {
    const current = ++revision;
    try {
      const { darkModeSites = [] } = await chrome.storage.local.get('darkModeSites');
      if (current !== revision) return;
      if (document.readyState === 'loading') return;
      if (darkModeSites.includes(pattern)) KarmoDarkEngine.enable();
      else KarmoDarkEngine.disable();
    } catch { KarmoDarkEngine.disable(); }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.darkModeSites) void refresh();
  });
  globalThis.karmoDarkMode = { refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  void refresh();
})();
