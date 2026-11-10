(() => {
  const selector = 'ytd-comment-view-model,ytd-comment-renderer', states = new WeakMap();
  const review = globalThis.KarmoFilterReview;
  let ready = false, enabled = true, timer;
  function schedule() { if (!timer) timer = setTimeout(() => { timer = undefined; scan(); }, 50); }
  function scan() {
    if (!ready) return;
    observer.disconnect();
    try {
      const entries = [];
      for (const root of document.querySelectorAll(selector)) {
        const body = root.querySelector('#content-text'), author = root.querySelector('#author-text');
        const text = KarmoCommentText.read(body);
        const item = review.comment(root), result = KarmoCommentSpam.classify(author?.textContent, text);
        const key = JSON.stringify([item.key, result, text, author?.textContent]);
        let state = states.get(root);
        if (state && state.key !== key) { state.notice.remove(); root.classList.remove('kl-spam-folded', 'kl-spam-hidden'); states.delete(root); state = undefined; }
        if (!enabled || result.level === 'none' || review.bypass(item.key)) {
          state?.notice.remove(); root.classList.remove('kl-spam-folded', 'kl-spam-hidden'); states.delete(root);
        } else {
          if (!state) {
            const notice = document.createElement('div'); notice.className = 'kl-spam-notice';
            const label = document.createElement('span');
            label.textContent = (result.level === 'high' ? '성인 광고 숨김' : '스팸 의심') + ': ' + result.reasons.join(', ');
            const show = document.createElement('button'); show.type = 'button'; KarmoControlIcons.apply(show, 'show', '한 번 보기');
            show.addEventListener('click', () => review.show(item.key)); notice.append(label, show);
            if (item.stable) {
              const allow = document.createElement('button'); allow.type = 'button'; KarmoControlIcons.apply(allow, 'allow', '이 댓글 항상 허용');
              allow.addEventListener('click', async () => {
                allow.disabled = true;
                try { await review.allow(item.key); } catch { allow.disabled = false; allow.textContent = '저장 실패, 다시 시도'; }
              }); notice.append(allow);
            }
            root.prepend(notice); root.classList.add('kl-spam-folded'); root.classList.toggle('kl-spam-hidden', result.level === 'high'); states.set(root, { key, notice });
          }
          entries.push({ ...item, root, kind: 'comment', reason: result.reasons.join(', ') });
        }
        globalThis.KarmoReplyGate?.complete(root, 'spam', !enabled || Boolean(body && author?.textContent.trim() && (body.textContent.trim() || body.querySelector('img'))));
      }
      review.set('comment-spam', entries);
    } finally { observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'alt', 'src', 'aria-label'] }); }
  }
  const observer = new MutationObserver(schedule);
  Promise.all([review.ready, chrome.storage.local.get({ commentSpam: true })]).then(([, values]) => { enabled = values.commentSpam !== false; ready = true; scan(); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.commentSpam) { enabled = changes.commentSpam.newValue !== false; schedule(); } });
  review.onChange(schedule);
  document.addEventListener('kl-replies-dirty', schedule);
  document.addEventListener('yt-navigate-finish', schedule);
})();
