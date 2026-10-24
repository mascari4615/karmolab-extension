(() => {
  const comments = 'ytd-comment-view-model,ytd-comment-renderer';
  const states = new WeakMap();
  let enabled = false, loaded = false, timer;

  function stateFor(root) {
    const key = location.pathname + location.search + '|' + (root.querySelector('a[href*="lc="]')?.getAttribute('href') || '');
    let state = states.get(root);
    if (!state || state.key !== key) {
      state = { key, attempted: false };
      states.set(root, state);
    }
    return state;
  }
  function schedule() {
    if (timer || !loaded || !enabled) return;
    timer = setTimeout(() => { timer = undefined; scan(); }, 250);
  }
  function scan() {
    if (!loaded || !enabled) return;
    for (const root of document.querySelectorAll(comments)) {
      const state = stateFor(root);
      if (state.attempted) continue;
      const button = root.querySelector('.translate-button [role="button"],.translate-button button');
      if (!button || button.closest(comments) !== root || button.textContent.trim().replace(/\s+/g, '') !== '한국어로번역') continue;
      if (button.disabled || button.getAttribute('aria-disabled') === 'true' || button.closest('[hidden],[aria-hidden="true"]') || !button.getClientRects().length) continue;
      state.attempted = true;
      button.click();
      schedule();
      return;
    }
  }
  // 원문 보기와 수동 번역 선택 보존, 자동 클릭 재시도 없음
  document.addEventListener('click', event => {
    const control = event.target.closest?.('.translate-button');
    const root = control?.closest(comments);
    if (root) stateFor(root).attempted = true;
  }, true);
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'aria-disabled', 'disabled', 'state'] });
  chrome.storage.local.get({ commentTranslate: true }).then(values => {
    enabled = values.commentTranslate !== false;
    loaded = true;
    schedule();
  }).catch(() => console.warn('KarmoLab: translation settings could not be read'));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.commentTranslate) return;
    enabled = changes.commentTranslate.newValue !== false;
    schedule();
  });
  document.addEventListener('yt-navigate-finish', schedule);
})();
