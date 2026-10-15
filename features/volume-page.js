(() => {
  if (globalThis.KarmoSiteVolume) { globalThis.KarmoSiteVolume(); return; }
  let value = null, active = false;
  const saved = new Map();
  function apply() {
    for (const media of document.querySelectorAll('video,audio')) {
      if (value === null) {
        const original = saved.get(media);
        if (original && Math.abs(media.volume - original.applied) < 0.001) media.volume = original.before;
        saved.delete(media); continue;
      }
      const next = active ? 1 : Math.min(value, 100) / 100;
      const original = saved.get(media) || { before: media.volume };
      if (original.applied !== next) { media.volume = next; original.applied = next; saved.set(media, original); }
    }
    for (const media of saved.keys()) if (!media.isConnected) saved.delete(media);
  }
  async function refresh() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'volume-query' });
      if (!result?.ok) return;
      value = result.sites[location.origin] ?? null; active = result.active;
      apply();
    } catch { /* Extension may be reloading. */ }
  }
  globalThis.KarmoSiteVolume = refresh;
  new MutationObserver(apply).observe(document.documentElement || document, { childList: true, subtree: true });
  document.addEventListener('loadedmetadata', apply, true);
  chrome.runtime.onMessage.addListener(message => { if (message?.type === 'volume-refresh') void refresh(); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.volumeSites) void refresh(); });
  void refresh();
})();
