(() => {
  const key = 'shortsCommentsWidth';
  const selector = 'ytd-shorts ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"][visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]';
  const handle = document.createElement('div');
  handle.className = 'kl-shorts-comments-resize';
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', chrome.i18n.getMessage('shortsCommentsResize'));
  handle.title = chrome.i18n.getMessage('shortsCommentsResizeHint');
  handle.hidden = true;
  let requested = 640, saved = 640, loaded = false, root, panel, frame, drag;
  let saveQueue = Promise.resolve();
  const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 280 && value <= 960;
  function limits() {
    const available = Math.min(innerWidth, root?.getBoundingClientRect().width || innerWidth);
    const max = Math.max(1, Math.min(960, available - (available >= 1000 ? 360 : 32)));
    return { min: Math.min(320, max), max };
  }
  function width() {
    const { min, max } = limits();
    return Math.round(Math.max(min, Math.min(max, requested)));
  }
  function setStyle(node, name, value) {
    if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
  }
  function paint() {
    if (!root || !panel) return;
    setStyle(root, '--kl-shorts-comments-width', width() + 'px');
    const rect = panel.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
    if (handle.hidden === visible) handle.hidden = !visible;
    if (!visible) return;
    setStyle(handle, 'left', Math.max(0, rect.left) + 'px');
    setStyle(handle, 'top', Math.max(0, rect.top) + 'px');
    setStyle(handle, 'height', Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) + 'px');
    const { min, max } = limits();
    handle.setAttribute('aria-valuemin', Math.round(min));
    handle.setAttribute('aria-valuemax', Math.round(max));
    handle.setAttribute('aria-valuenow', width());
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; mount(); });
  }
  const resize = new ResizeObserver(schedule);
  function mount() {
    const next = loaded && location.pathname.startsWith('/shorts/') ? document.querySelector(selector) : null;
    if (next !== panel) {
      cancelDrag();
      root?.removeAttribute('data-kl-resizable-comments');
      root?.style.removeProperty('--kl-shorts-comments-width');
      resize.disconnect();
      panel = next; root = panel?.closest('ytd-shorts');
      if (root) {
        root.setAttribute('data-kl-resizable-comments', '');
        resize.observe(root); resize.observe(panel);
        if (!handle.isConnected) document.documentElement.append(handle);
      } else if (!handle.hidden) handle.hidden = true;
    }
    paint();
  }
  function persist() {
    const value = requested;
    saveQueue = saveQueue.then(async () => {
      try {
        await chrome.storage.local.set({ [key]: value });
        saved = value;
        handle.title = chrome.i18n.getMessage('shortsCommentsResizeHint');
      } catch {
        if (requested === value) { requested = saved; paint(); }
        handle.title = chrome.i18n.getMessage('panelSaveError');
      }
    });
  }
  function cancelDrag() {
    if (!drag) return;
    const id = drag.id;
    requested = drag.previous; drag = null;
    if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
    handle.removeAttribute('data-dragging'); paint();
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !panel || drag) return;
    event.preventDefault(); event.stopPropagation();
    handle.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, width: width(), previous: requested };
    handle.setPointerCapture(event.pointerId);
    handle.setAttribute('data-dragging', '');
  });
  handle.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const { min, max } = limits();
    requested = Math.round(Math.max(min, Math.min(max, drag.width + drag.x - event.clientX)));
    paint();
  });
  handle.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    drag = null; handle.releasePointerCapture(event.pointerId);
    handle.removeAttribute('data-dragging'); persist();
  });
  handle.addEventListener('pointercancel', cancelDrag);
  handle.addEventListener('lostpointercapture', cancelDrag);
  handle.addEventListener('dblclick', event => {
    event.preventDefault(); requested = 640; paint(); persist();
  });
  handle.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); cancelDrag(); return; }
    const { min, max } = limits(), step = event.shiftKey ? 64 : 16;
    const values = { ArrowLeft: width() + step, ArrowRight: width() - step, Home: 640, End: max };
    if (!(event.key in values)) return;
    event.preventDefault();
    requested = Math.max(min, Math.min(max, values[event.key])); paint(); persist();
  });
  handle.addEventListener('keyup', event => event.stopPropagation());
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['visibility', 'hidden', 'is-watch-while-mode', 'small-screen-persistent-panel'],
  });
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);
  document.addEventListener('yt-navigate-start', () => { cancelDrag(); handle.hidden = true; });
  document.addEventListener('yt-navigate-finish', schedule);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[key]) return;
    saved = valid(changes[key].newValue) ? changes[key].newValue : 640;
    if (!drag) { requested = saved; schedule(); }
  });
  chrome.storage.local.get(key).then(value => {
    requested = saved = valid(value[key]) ? value[key] : 640;
    loaded = true; schedule();
  }).catch(() => { loaded = true; schedule(); });
})();
