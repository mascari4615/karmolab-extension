(() => {
  const key = 'homePreviewVolume', listeners = new Set();
  let requested = null, saved = null, loaded = false, error = false, revision = 0;
  let writes = Promise.resolve(), ownWrite;
  const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  function nativeVolume() {
    try {
      const record = JSON.parse(localStorage.getItem('yt-player-volume'));
      if (record?.expiration && record.expiration < Date.now()) return 10;
      const data = typeof record?.data === 'string' ? JSON.parse(record.data) : record?.data;
      return valid(data?.volume) ? data.volume : 10;
    } catch { return 10; }
  }
  const percent = () => requested === null ? nativeVolume() : requested;
  const preview = media => location.pathname === '/' && media instanceof HTMLMediaElement && Boolean(media.closest('#inline-preview-player,ytd-video-preview'));
  function apply(media) {
    if (!preview(media)) return;
    const value = percent() / 100;
    if (Math.abs(media.volume - value) > 0.0001) media.volume = value;
  }
  function refresh() {
    for (const media of document.querySelectorAll('video')) apply(media);
    const value = { percent: percent(), follow: requested === null, loaded, error };
    listeners.forEach(listener => listener(value));
  }
  function choose(value, persist) {
    if (!loaded || (value !== null && !valid(value))) return;
    requested = value; error = false; revision++; refresh();
    if (!persist) return;
    const version = revision;
    writes = writes.then(async () => {
      ownWrite = { value };
      try { await chrome.storage.local.set({ [key]: value }); saved = value; }
      catch { if (version === revision) { requested = saved; error = true; refresh(); } }
      finally { ownWrite = undefined; }
    });
  }
  globalThis.KarmoPreviewVolume = {
    create() {
      const host = document.createElement('div'); host.id = 'kl-home-preview-volume';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>
        :host{display:block;min-width:210px;max-width:100%;color:var(--yt-spec-text-primary,#0f0f0f);font:13px/1.4 Roboto,Arial,sans-serif}
        .row,label{display:flex;align-items:center;gap:8px;min-height:32px} .row{flex-wrap:wrap}
        input[type=range]{width:120px;max-width:100%;accent-color:#065fd4} input[type=checkbox]{accent-color:#065fd4}
        label{cursor:pointer}output{min-width:36px}input:focus-visible{outline:2px solid #065fd4;outline-offset:2px}
        .error{color:var(--yt-spec-text-secondary,#606060)}.error:empty{display:none}
      </style><div class="row"><label for="volume"></label><input id="volume" type="range" min="0" max="100" step="1"><output for="volume"></output></div><label><input id="follow" type="checkbox"><span></span></label><div class="error" role="status"></div>`;
      const slider = shadow.querySelector('#volume'), follow = shadow.querySelector('#follow');
      shadow.querySelector('label[for=volume]').textContent = chrome.i18n.getMessage('homePreviewVolume');
      shadow.querySelector('label span').textContent = chrome.i18n.getMessage('homePreviewFollow');
      slider.addEventListener('input', () => choose(Number(slider.value), false));
      slider.addEventListener('change', () => choose(Number(slider.value), true));
      follow.addEventListener('change', () => choose(follow.checked ? null : percent(), true));
      shadow.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); });
      shadow.addEventListener('keyup', event => event.stopPropagation());
      const render = state => {
        slider.disabled = follow.disabled = !state.loaded;
        slider.value = state.percent; follow.checked = state.follow;
        shadow.querySelector('output').textContent = Math.round(state.percent) + '%';
        shadow.querySelector('.error').textContent = state.error ? chrome.i18n.getMessage('panelSaveError') : '';
      };
      listeners.add(render); refresh(); return host;
    },
  };
  new MutationObserver(() => { for (const media of document.querySelectorAll('video')) apply(media); }).observe(document, { childList: true, subtree: true });
  for (const name of ['play', 'playing', 'loadedmetadata', 'volumechange']) document.addEventListener(name, event => apply(event.target), true);
  document.addEventListener('pointerover', event => {
    if (location.pathname === '/' && event.target.closest?.('ytd-rich-item-renderer,#inline-preview-player,ytd-video-preview')) refresh();
  }, true);
  window.addEventListener('storage', event => { if (event.key === 'yt-player-volume') refresh(); });
  window.addEventListener('focus', refresh);
  document.addEventListener('yt-navigate-finish', refresh);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[key]) return;
    saved = valid(changes[key].newValue) ? changes[key].newValue : null;
    if (ownWrite && ownWrite.value === saved) return;
    requested = saved; revision++; error = false; refresh();
  });
  const initialRevision = revision;
  chrome.storage.local.get(key).then(values => {
    if (initialRevision === revision) requested = saved = valid(values[key]) ? values[key] : null;
    loaded = true; refresh();
  }).catch(() => { loaded = true; error = true; refresh(); });
})();
