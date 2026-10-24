(() => {
  const selector = 'ytd-comment-view-model,ytd-comment-renderer';
  const states = new WeakMap();
  let words = [], enabled = true, commentsEnabled = true, loaded = false, scheduled = false, generation = 0;
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
        const text = root.querySelector('#content-text')?.textContent || '';
        const item = review?.comment(root);
        const matching = enabled && commentsEnabled && !review?.bypass(item?.key) && words.length && KarmoKeywords.match(text, words);
        let state = states.get(root);
        if (state && state.target !== target) { state.notice.remove(); state.target.classList.remove('kl-keyword-folded'); states.delete(root); state = undefined; }
        if (!matching) {
          state?.notice.remove(); target.classList.remove('kl-keyword-folded'); states.delete(root); continue;
        }
        if (state && state.text === text && state.generation === generation && state.notice.parentElement === target) {
          if (item && target.classList.contains('kl-keyword-folded')) entries.push({ ...item, root: target, kind: 'comment', reason: msg('reviewKeyword') + ': ' + matching });
          continue;
        }
        state?.notice.remove();
        const notice = document.createElement('div'), label = document.createElement('span'), button = document.createElement('button');
        notice.className = 'kl-keyword-notice';
        label.textContent = msg('keywordFolded');
        button.type = 'button'; button.textContent = msg('keywordShow'); button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', () => {
          const folded = target.classList.toggle('kl-keyword-folded');
          button.textContent = msg(folded ? 'keywordShow' : 'keywordHide');
          button.setAttribute('aria-expanded', String(!folded));
          schedule();
        });
        notice.append(label, button); target.prepend(notice); target.classList.add('kl-keyword-folded');
        states.set(root, { text, notice, generation, target });
        if (item) entries.push({ ...item, root: target, kind: 'comment', reason: msg('reviewKeyword') + ': ' + matching });
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
    generation++; schedule();
  });
  document.addEventListener('yt-navigate-finish', schedule);
  review?.onChange(schedule);
})();
