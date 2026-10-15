(() => {
  if (globalThis.KarmoShortsCount) return;
  const prefix = 'shortsDayView:';
  const entries = new Map();
  const timePrefix = 'shortsDayTime:';
  const timeEntries = new Map();
  const session = crypto.randomUUID();
  const state = { enabled: true, mode: 'both', showTime: true, ready: false, unique: 0, views: 0, error: false, timeError: false };
  const localDay = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  let day = localDay();
  let visit = {};
  let ranges = [], dirty = false, writing = false, lastFlush = 0;
  const timeKey = () => timePrefix + day + ':' + session;
  const validRanges = value => Array.isArray(value) ? value.filter(pair => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite) && pair[1] > pair[0] && pair[1] - pair[0] <= 86400000) : [];
  function watchMilliseconds() {
    const all = [...timeEntries].filter(([key]) => key.startsWith(timePrefix + day + ':') && key !== timeKey()).flatMap(([, value]) => validRanges(value));
    all.push(...ranges);
    all.sort((a, b) => a[0] - b[0]);
    let total = 0, end = -Infinity;
    for (const [start, stop] of all) { total += Math.max(0, stop - Math.max(start, end)); end = Math.max(end, stop); }
    return total;
  }
  function flushTime() {
    if (!dirty || writing) return;
    const key = timeKey(), snapshot = ranges.map(pair => [...pair]);
    dirty = false; writing = true; lastFlush = performance.now();
    chrome.storage.local.set({ [key]: snapshot }).then(() => {
      if (key === timeKey()) timeEntries.set(key, snapshot);
      else return chrome.storage.local.remove(key);
      state.timeError = false;
    }).catch(() => { if (key === timeKey()) dirty = true; state.timeError = true; })
      .finally(() => { writing = false; if (dirty && !state.timeError && (!state.enabled || document.visibilityState !== 'visible')) flushTime(); });
  }
  const recount = () => {
    const ids = [...entries].filter(([key]) => key.startsWith(prefix + day + ':')).map(([, id]) => id);
    state.unique = new Set(ids).size;
    state.views = ids.length;
  };
  const cleanup = () => {
    const old = [...entries.keys(), ...timeEntries.keys()].filter(key => key.split(':')[1] < day);
    if (old.length) chrome.storage.local.remove(old).catch(() => { state.error = true; });
  };
  globalThis.KarmoShortsCount = {
    get enabled() { return state.enabled; },
    text() {
      if (!state.enabled) return '';
      if (state.error || state.timeError) return chrome.i18n.getMessage('shortsCountError');
      if (!state.ready) return chrome.i18n.getMessage('shortsCountLoading');
      const n = value => new Intl.NumberFormat(document.documentElement.lang || navigator.language).format(value);
      const count = state.mode === 'unique' ? chrome.i18n.getMessage('shortsCountUnique', n(state.unique))
        : state.mode === 'views' ? chrome.i18n.getMessage('shortsCountViews', n(state.views))
          : chrome.i18n.getMessage('shortsCountBoth', [n(state.unique), n(state.views)]);
      if (!state.showTime) return count;
      const seconds = Math.floor(watchMilliseconds() / 1000), minutes = Math.floor(seconds / 60);
      const time = seconds < 60 ? chrome.i18n.getMessage('shortsWatchSeconds', n(seconds))
        : minutes < 60 ? chrome.i18n.getMessage('shortsWatchMinutes', n(minutes))
          : chrome.i18n.getMessage('shortsWatchHours', [n(Math.floor(minutes / 60)), n(minutes % 60)]);
      return count + ' / ' + time;
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
    if (today !== day) { day = today; visit = {}; ranges = []; dirty = false; recount(); cleanup(); }
    const id = state.enabled ? location.pathname.match(/^\/shorts\/([\w-]{11})(?:\/|$)/)?.[1] : null;
    if (visit.id !== id || visit.day !== day) { flushTime(); visit = { id, day, elapsed: 0, counted: false, previous: null }; }
    if (!id) return;
    const video = document.visibilityState === 'visible' ? activePlayer(id) : null;
    const now = performance.now();
    const playable = video && !video.paused && !video.ended && !video.seeking && video.readyState >= 2;
    const previous = visit.previous;
    if (playable && previous?.video === video && now - previous.now <= 1000) {
      const wall = now - previous.now;
      let progress = video.currentTime - previous.time;
      if (progress < 0 && Number.isFinite(video.duration) && previous.time > video.duration - 1 && video.currentTime < 1) progress += video.duration;
      const advanced = progress * 1000 / (video.playbackRate || 1);
      if (advanced > 0 && advanced <= wall + 300) {
        const elapsed = Math.min(wall, advanced);
        visit.elapsed += elapsed;
        const stop = Date.now(), start = stop - elapsed, last = ranges.at(-1);
        if (last && start <= last[1] + 1 && stop >= last[1]) last[1] = stop;
        else ranges.push([start, stop]);
        dirty = true;
      }
    }
    visit.previous = playable ? { video, time: video.currentTime, now } : null;
    if (!playable || now - lastFlush >= 5000) flushTime();
    if (visit.counted || visit.elapsed < 2000) return;
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
      if (key.startsWith(timePrefix)) {
        if (change.newValue) timeEntries.set(key, change.newValue);
        else timeEntries.delete(key);
      }
      if (key === 'shortsCount') { flushTime(); state.enabled = change.newValue !== false; visit = {}; }
      if (key === 'shortsCountMode') state.mode = change.newValue || 'both';
      if (key === 'shortsWatchTime') state.showTime = change.newValue !== false;
    }
    recount();
  });
  chrome.storage.local.get(null).then(values => {
    for (const [key, value] of Object.entries(values)) if (key.startsWith(prefix)) entries.set(key, value);
    for (const [key, value] of Object.entries(values)) if (key.startsWith(timePrefix)) timeEntries.set(key, value);
    state.enabled = values.shortsCount !== false;
    state.mode = values.shortsCountMode || 'both';
    state.showTime = values.shortsWatchTime !== false;
    state.ready = true;
    recount(); cleanup();
  }).catch(() => { state.error = true; });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') { visit.previous = null; flushTime(); } });
  addEventListener('pagehide', flushTime);
  setInterval(tick, 250);
})();
