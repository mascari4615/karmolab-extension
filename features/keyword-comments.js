(() => {
  const selector = 'ytd-comment-view-model,ytd-comment-renderer';
  const targets = new WeakMap();
  let words = [], enabled = true, commentsEnabled = true, loaded = false, scheduled = false;
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
        const text = root.querySelector('#content-text')?.textContent || '';
        const item = review?.comment(root);
        const matching = enabled && commentsEnabled && !review?.bypass(item?.key) && words.length && KarmoKeywords.match(text, words);
        const checked = !enabled || !commentsEnabled || !words.length || Boolean(text.trim() || root.querySelector('#content-text img'));
        if (target !== root) root.classList.remove('kl-keyword-folded');
        target.classList.toggle('kl-keyword-folded', Boolean(matching));
        globalThis.KarmoReplyGate?.complete(root, 'words', checked);
        if (matching && item) entries.push({ ...item, root: target, kind: 'comment', reason: msg('reviewKeyword') + ': ' + matching });
      }
      review?.set('keyword-comments', entries);
    } finally { observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true }); }
  }
  function schedule() { if (!scheduled) { scheduled = true; setTimeout(() => { scheduled = false; scan(); }, 100); } }
  const observer = new MutationObserver(schedule);
  chrome.storage.local.get({ keywordWords: [], keywordEnabled: true, keywordComments: true }).then(async values => {
    await review?.ready;
    words = KarmoKeywords.parse(values.keywordWords.join('\n')); enabled = values.keywordEnabled !== false; commentsEnabled = values.keywordComments !== false; loaded = true; scan();
  }).catch(() => console.warn('KarmoLab: keyword settings could not be read'));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || (!changes.keywordWords && !changes.keywordEnabled && !changes.keywordComments)) return;
    if (changes.keywordWords) words = KarmoKeywords.parse((changes.keywordWords.newValue || []).join('\n'));
    if (changes.keywordEnabled) enabled = changes.keywordEnabled.newValue !== false;
    if (changes.keywordComments) commentsEnabled = changes.keywordComments.newValue !== false;
    schedule();
  });
  document.addEventListener('yt-navigate-finish', schedule);
  document.addEventListener('kl-replies-dirty', schedule);
  review?.onChange(schedule);
})();
