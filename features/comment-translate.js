(() => {
  const comments = 'ytd-comment-view-model,ytd-comment-renderer';
  const states = new WeakMap();
  let enabled = false, loaded = false, timer;
  function language(root) {
    const body = root.querySelector('#content-text'), text = body?.textContent || '';
    const explicit = body?.getAttribute('lang');
    const code = explicit?.split('-')[0] || (/[ぁ-ゖァ-ヺ]/u.test(text) ? 'ja' : /[가-힣]/u.test(text) ? 'ko' : '');
    const known = { ja: ['🇯🇵', '일본어'], ko: ['🇰🇷', '한국어'], en: ['🇬🇧', '영어'], zh: ['🌐', '중국어'], ru: ['🌐', '러시아어'], es: ['🌐', '스페인어'], fr: ['🇫🇷', '프랑스어'], de: ['🇩🇪', '독일어'] };
    const result = known[code] || ['🌐', '원문 언어 미확인'];
    return [...result, code, !explicit];
  }
  function status(root, state) {
    let badge = root.querySelector('.kl-translation-status');
    if (!badge) { badge = document.createElement('span'); badge.className = 'kl-translation-status'; badge.setAttribute('role', 'status'); root.querySelector('.translate-button')?.append(badge); }
    const busy = state.pending;
    badge.classList.toggle('kl-translating', busy);
    badge.textContent = busy ? '' : state.language[0];
    if (!busy && state.language[2] === 'ja') badge.innerHTML = '<svg viewBox="0 0 24 16" width="18" height="12" aria-hidden="true"><path fill="#fff" d="M0 0h24v16H0z"/><circle cx="12" cy="8" r="4.5" fill="#bc002d"/></svg>';
    const label = busy ? '번역 중' : state.failed ? '번역 응답 확인 안 됨, 원문 표시' : '원문: ' + state.language[1] + (state.language[3] && state.language[2] ? ' (추정)' : '');
    badge.title = label; badge.setAttribute('aria-label', label);
  }
  function begin(root, state) {
    state.language = language(root); state.original = root.querySelector('#content-text')?.textContent;
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
      if (state.pending && root.querySelector('#content-text')?.textContent !== state.original) {
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
      if (control.textContent.trim().replace(/\s+/g, '') === '한국어로번역' && !state.pending) begin(root, state);
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
