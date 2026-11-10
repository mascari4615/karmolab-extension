(() => {
  const comments = 'ytd-comment-view-model,ytd-comment-renderer';
  const states = new WeakMap();
  let enabled = false, loaded = false, timer;
  function status(root, state) {
    let badge = root.querySelector('.kl-translation-status');
    if (!badge) { badge = document.createElement('span'); badge.className = 'kl-translation-status'; badge.setAttribute('role', 'status'); root.querySelector('.translate-button')?.append(badge); }
    const busy = state.pending;
    badge.classList.toggle('kl-translating', busy);
    badge.textContent = busy ? '' : state.failed ? '⚠' : state.language.code ? state.language.code.split('-')[0].toUpperCase() : '🌐';
    if (!busy && !state.failed && state.language.flag) badge.innerHTML = state.language.flag;
    const label = busy ? '번역 중' : state.failed ? '번역 응답 확인 안 됨, 원문 표시' : '원문: ' + state.language.name + (state.language.source === 'detected' ? ' (자동 감지, 국적 아님)' : '');
    badge.title = label; badge.setAttribute('aria-label', label);
  }
  function begin(root, state) {
    const body = root.querySelector('#content-text');
    state.language ||= KarmoCommentLanguage.describe('und','unknown'); state.original = KarmoCommentText.read(body);
    KarmoCommentLanguage.detect(state.original, body?.getAttribute('lang')).then(language => {
      if (states.get(root) !== state) return;
      state.language = language; status(root, state);
    });
    state.pending = true; state.failed = false; status(root, state);
    clearTimeout(state.timeout);
    state.timeout = setTimeout(() => { if (states.get(root) === state && state.pending) { state.pending = false; state.failed = true; status(root, state); } }, 15000);
  }

  function stateFor(root) {
    const key = location.pathname + location.search + '|' + (root.querySelector('a[href*="lc="]')?.getAttribute('href') || '');
    let state = states.get(root);
    if (!state || state.key !== key) {
      clearTimeout(state?.timeout); root.querySelector('.kl-translation-status')?.remove();
      state = { key, attempted: false };
      states.set(root, state);
    }
    return state;
  }
  function schedule() {
    if (timer || !loaded) return;
    timer = setTimeout(() => { timer = undefined; scan(); }, 250);
  }
  function scan() {
    if (!loaded) return;
    for (const root of document.querySelectorAll(comments)) {
      const state = stateFor(root);
      if (state.pending && (KarmoCommentText.read(root.querySelector('#content-text')) !== state.original || root.querySelector('.translate-button')?.getAttribute('state') === 'toggled')) {
        state.pending = false; clearTimeout(state.timeout); status(root, state);
      }
      if (!enabled) continue;
      if (state.attempted) continue;
      const button = root.querySelector('.translate-button [role="button"],.translate-button button');
      if (!button || button.closest(comments) !== root || button.textContent.trim().replace(/\s+/g, '') !== '한국어로번역') continue;
      if (button.disabled || button.getAttribute('aria-disabled') === 'true' || button.closest('[hidden],[aria-hidden="true"]') || !button.getClientRects().length) continue;
      state.attempted = true;
      begin(root, state);
      button.click();
      schedule();
      return;
    }
  }
  // 원문 보기와 수동 번역 선택 보존, 자동 클릭 재시도 없음
  document.addEventListener('click', event => {
    const control = event.target.closest?.('.translate-button');
    const root = control?.closest(comments);
    if (root && !event.target.closest?.('.kl-translation-status')) {
      const state = stateFor(root); state.attempted = true;
      const button = control.querySelector('[role="button"],button');
      if (button?.textContent.trim().replace(/\s+/g, '') === '한국어로번역' && !state.pending) begin(root, state);
    }
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
