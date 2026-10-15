(() => {
  if (globalThis.KarmoShortsCount) return;
  const prefix = 'shortsDayView:';
  const entries = new Map();
  const state = { enabled: true, mode: 'both', ready: false, unique: 0, views: 0, error: false };
  const localDay = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  let day = localDay();
  let visit = {};
  const recount = () => {
    const ids = [...entries].filter(([key]) => key.startsWith(prefix + day + ':')).map(([, id]) => id);
    state.unique = new Set(ids).size;
    state.views = ids.length;
  };
  const cleanup = () => {
    const old = [...entries.keys()].filter(key => key.slice(prefix.length, prefix.length + 10) < day);
    if (old.length) chrome.storage.local.remove(old).catch(() => { state.error = true; });
  };
  globalThis.KarmoShortsCount = {
    get enabled() { return state.enabled; },
    text() {
      if (!state.enabled) return '';
      if (state.error) return chrome.i18n.getMessage('shortsCountError');
      if (!state.ready) return chrome.i18n.getMessage('shortsCountLoading');
      const n = value => new Intl.NumberFormat(document.documentElement.lang || navigator.language).format(value);
      return state.mode === 'unique' ? chrome.i18n.getMessage('shortsCountUnique', n(state.unique))
        : state.mode === 'views' ? chrome.i18n.getMessage('shortsCountViews', n(state.views))
          : chrome.i18n.getMessage('shortsCountBoth', [n(state.unique), n(state.views)]);
    },
  };

  function activePlayer(id) {
    let best = null, bestArea = 0;
    for (const node of document.querySelectorAll('ytd-shorts #shorts-player')) {
      const renderer = node.closest('ytd-reel-video-renderer');
      const links = renderer ? [...renderer.querySelectorAll('a[href*="/shorts/"]')]
        .map(a => a.getAttribute('href').match(/\/shorts\/([\w-]{11})(?:[/?#]|$)/)?.[1]).filter(Boolean) : [];
      if (links.length && !links.includes(id)) continue;
      if (node.closest('.kl-block-playback') || node.querySelector('.ad-showing,.ad-interrupting')) continue;
      const rect = node.getBoundingClientRect();
      const area = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0))
        * Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
      if (area < rect.width * rect.height / 2 || area <= bestArea) continue;
      const video = node.querySelector('video');
      if (video) { best = video; bestArea = area; }
    }
    return best;
  }

  function tick() {
    if (!state.ready) return;
    const today = localDay();
    if (today !== day) { day = today; visit = {}; recount(); cleanup(); }
    const id = state.enabled ? location.pathname.match(/^\/shorts\/([\w-]{11})(?:\/|$)/)?.[1] : null;
    if (visit.id !== id || visit.day !== day) visit = { id, day, elapsed: 0, counted: false, previous: null };
    if (!id || visit.counted) return;
    const video = document.visibilityState === 'visible' ? activePlayer(id) : null;
    const now = performance.now();
    const playable = video && !video.paused && !video.ended && !video.seeking && video.readyState >= 2;
    const previous = visit.previous;
    if (playable && previous?.video === video && now - previous.now <= 1000) {
      const advanced = (video.currentTime - previous.time) * 1000 / (video.playbackRate || 1);
      if (advanced > 0) visit.elapsed += Math.min(now - previous.now, advanced);
    }
    visit.previous = playable ? { video, time: video.currentTime, now } : null;
    if (visit.elapsed < 2000) return;
    visit.counted = true;
    // One key per qualified visit avoids cross-tab read/modify/write losses.
    const key = prefix + day + ':' + crypto.randomUUID();
    chrome.storage.local.set({ [key]: id }).then(() => {
      entries.set(key, id);
      state.error = false;
      recount();
    }).catch(() => { state.error = true; });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) {
      if (key.startsWith(prefix)) {
        if (change.newValue) entries.set(key, change.newValue);
        else entries.delete(key);
      }
      if (key === 'shortsCount') { state.enabled = change.newValue !== false; visit = {}; }
      if (key === 'shortsCountMode') state.mode = change.newValue || 'both';
    }
    recount();
  });
  chrome.storage.local.get(null).then(values => {
    for (const [key, value] of Object.entries(values)) if (key.startsWith(prefix)) entries.set(key, value);
    state.enabled = values.shortsCount !== false;
    state.mode = values.shortsCountMode || 'both';
    state.ready = true;
    recount(); cleanup();
  }).catch(() => { state.error = true; });
  setInterval(tick, 250);
})();
