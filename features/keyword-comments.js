(() => {
  const selector = 'ytd-comment-view-model,ytd-comment-renderer';
  const targets = new WeakMap();
  const attempted = new WeakMap();
  let words = [], autoWords = [], enabled = true, commentsEnabled = true, loaded = false, scheduled = false, generation = 0;
  const review = globalThis.KarmoFilterReview;
  const msg = key => chrome.i18n.getMessage(key);
  function scan() {
    if (!loaded) return;
    observer.disconnect();
    try {
      const entries = [];
      for (const root of document.querySelectorAll(selector)) {
        const thread = root.closest('ytd-comment-thread-renderer');
        const target = thread?.querySelector(selector) === root ? thread : root;
        const previous = targets.get(root);
        if (previous && previous !== target) previous.classList.remove('kl-keyword-folded');
        targets.set(root, target);
        const body = root.querySelector('#content-text');
        const text = globalThis.KarmoCommentText?.read(body) ?? body?.textContent ?? '';
        const item = review?.comment(root);
        const matching = enabled && commentsEnabled && !review?.bypass(item?.key) && words.length && KarmoKeywords.match(text, words);
        const checked = !enabled || !commentsEnabled || !words.length || Boolean(text.trim() || root.querySelector('#content-text img'));
        if (target !== root) root.classList.remove('kl-keyword-folded');
        target.classList.toggle('kl-keyword-folded', Boolean(matching));
        const automatic = matching && KarmoKeywords.match(text, autoWords.filter(word => words.some(value => KarmoKeywords.normalize(value) === KarmoKeywords.normalize(word))));
        const fingerprint = JSON.stringify([generation, automatic, root.querySelector('#author-text')?.getAttribute('href')]);
        if (automatic && attempted.get(root) !== fingerprint) {
          attempted.set(root, fingerprint);
          globalThis.KarmoUserBlock?.autoBlock(root, automatic).catch(() => { root.setAttribute('data-kl-auto-block-error', 'true'); schedule(); });
        }
        globalThis.KarmoReplyGate?.complete(root, 'words', checked);
        if (matching && item) entries.push({ ...item, root: target, kind: 'comment', reason: msg('reviewKeyword') + ': ' + matching + (root.hasAttribute('data-kl-auto-block-error') ? ' (자동 차단 저장 실패)' : '') });
      }
      review?.set('keyword-comments', entries);
    } finally { observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['alt', 'src', 'aria-label'] }); }
  }
  function schedule() { if (!scheduled) { scheduled = true; setTimeout(() => { scheduled = false; scan(); }, 100); } }
  const observer = new MutationObserver(schedule);
  chrome.storage.local.get({ keywordWords: [], keywordAutoBlockWords: [], keywordEnabled: true, keywordComments: true }).then(async values => {
    await review?.ready;
    words = KarmoKeywords.parse(values.keywordWords.join('\n')); autoWords = KarmoKeywords.parse(values.keywordAutoBlockWords.join('\n')); enabled = values.keywordEnabled !== false; commentsEnabled = values.keywordComments !== false; loaded = true; scan();
  }).catch(() => console.warn('KarmoLab: keyword settings could not be read'));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || (!changes.keywordWords && !changes.keywordEnabled && !changes.keywordComments && !changes.keywordAutoBlockWords)) return;
    if (changes.keywordWords) words = KarmoKeywords.parse((changes.keywordWords.newValue || []).join('\n'));
    if (changes.keywordAutoBlockWords) autoWords = KarmoKeywords.parse((changes.keywordAutoBlockWords.newValue || []).join('\n'));
    if (changes.keywordEnabled) enabled = changes.keywordEnabled.newValue !== false;
    if (changes.keywordComments) commentsEnabled = changes.keywordComments.newValue !== false;
    generation++; schedule();
  });
  document.addEventListener('yt-navigate-finish', schedule);
  document.addEventListener('kl-replies-dirty', schedule);
  review?.onChange(schedule);
})();
