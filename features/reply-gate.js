(() => {
  const comments = 'ytd-comment-view-model,ytd-comment-renderer';
  const groups = 'ytd-comment-replies-renderer';
  const states = new WeakMap(), totals = new WeakMap();
  let queued = false;
  const signature = root => JSON.stringify([
    root.querySelector('#author-text')?.getAttribute('href'),
    root.querySelector('#content-text')?.textContent,
    root.querySelector('a[href*="lc="]')?.getAttribute('href'),
  ]);
  function state(root) {
    const key = signature(root);
    let current = states.get(root);
    if (!current || current.key !== key) {
      current = { key, users: false, words: false };
      states.set(root, current);
      root.removeAttribute('data-kl-reply-checked');
    }
    return current;
  }
  function refreshGroups() {
    for (const group of document.querySelectorAll(groups)) {
      const parent = group.closest('ytd-comment-thread-renderer')?.querySelector(comments);
      const owner = parent ? signature(parent) : '';
      let total = totals.get(group);
      if (!total || total.owner !== owner) { total = { owner, count: 0 }; totals.set(group, total); }
      for (const button of group.querySelectorAll('#more-replies button,#more-replies-sub-thread button')) {
        if (button.closest(groups) !== group) continue;
        const match = (button.getAttribute('aria-label') || button.textContent).trim().match(/^(?:답글\s+([\d,]+)개|([\d,]+)\s+repl(?:y|ies))$/i);
        if (match) total.count = Number((match[1] || match[2]).replaceAll(',', ''));
      }
      const replies = [...group.querySelectorAll(comments)];
      const ids = new Set(replies.map(root => root.querySelector('a[href*="lc="]')?.getAttribute('href') || root));
      const complete = total.count > 0 && ids.size === total.count && !group.querySelector('ytd-continuation-item-renderer');
      const empty = complete && replies.every(root => {
        const current = state(root);
        return current.users && current.words && Boolean(root.closest('.kl-block-hidden,.kl-block-leaving,.kl-keyword-folded'));
      });
      group.classList.toggle('kl-replies-filtered', empty);
      let notice = group.querySelector(':scope > .kl-replies-notice');
      if (empty && !notice) {
        notice = document.createElement('span'); notice.className = 'kl-replies-notice';
        notice.textContent = chrome.i18n.getMessage('repliesFiltered');
        notice.setAttribute('role', 'status'); group.append(notice);
      } else if (!empty) notice?.remove();
    }
  }
  function inspect() {
    queued = false;
    let dirty = false;
    for (const root of document.querySelectorAll(comments)) {
      if (!root.closest(groups)) continue;
      const previous = states.get(root), current = state(root);
      if (previous !== current) dirty = true;
    }
    refreshGroups();
    if (dirty) document.dispatchEvent(new Event('kl-replies-dirty'));
  }
  function schedule() {
    if (!queued) { queued = true; queueMicrotask(inspect); }
  }
  function invalidate() {
    for (const root of document.querySelectorAll(comments)) {
      if (!root.closest(groups)) continue;
      states.delete(root); root.removeAttribute('data-kl-reply-checked');
    }
    schedule();
  }
  globalThis.KarmoReplyGate = {
    complete(root, filter, ready) {
      if (!root.closest(groups)) return;
      const current = state(root);
      current[filter] = Boolean(ready);
      root.toggleAttribute('data-kl-reply-checked', current.users && current.words);
      schedule();
    },
    invalidate,
  };
  new MutationObserver(schedule).observe(document, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['href', 'hidden', 'aria-label'],
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.keys(changes).some(key => key.startsWith('blockedChannel:') || key.startsWith('filterAllow:') || ['userBlock', 'keywordEnabled', 'keywordComments', 'keywordWords'].includes(key))) invalidate();
  });
  document.addEventListener('yt-navigate-start', invalidate);
  schedule();
})();
