(() => {
  if (globalThis.karmoDarkMode) { globalThis.karmoDarkMode.refresh(); return; }
  const pattern = `${location.protocol}//${location.hostname}/*`;
  let revision = 0;
  // Only page resources already reachable with ordinary CORS; no privileged fetch bridge.
  DarkReader.setFetchMethod(url => fetch(url, { credentials: 'omit' }));
  async function refresh() {
    const current = ++revision;
    try {
      const { darkModeSites = [] } = await chrome.storage.local.get('darkModeSites');
      if (current !== revision) return;
      if (darkModeSites.includes(pattern)) DarkReader.enable({ brightness: 100, contrast: 100, sepia: 0 });
      else DarkReader.disable();
    } catch { DarkReader.disable(); }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.darkModeSites) void refresh();
  });
  globalThis.karmoDarkMode = { refresh };
  void refresh();
})();
