(() => {
  let commentMode = 'default', homeMode = 'default', grid, timer;
  const changed = new Set();
  const resize = new ResizeObserver(updateColumns);
  function updateColumns() {
    if (!grid || homeMode === 'default') return;
    const value = String(KarmoDensity.columns(grid.getBoundingClientRect().width, homeMode));
    if (grid.style.getPropertyValue('--kl-home-columns') !== value) grid.style.setProperty('--kl-home-columns', value);
  }
  function apply() {
    document.documentElement.dataset.klCommentDensity = commentMode;
    if (commentMode === 'compact') {
      for (const link of document.querySelectorAll('ytd-comment-view-model #published-time-text a,ytd-comment-renderer #published-time-text a')) {
        const value = KarmoDensity.publishedTime(link.textContent);
        if (link.dataset.klDate !== value.text) link.dataset.klDate = value.text;
        link.toggleAttribute('data-kl-edited', value.edited);
      }
    }
    const next = homeMode !== 'default' && location.pathname === '/'
      ? document.querySelector('ytd-browse[page-subtype="home"]:not([hidden]) ytd-rich-grid-renderer') : null;
    if (next !== grid) {
      resize.disconnect(); grid?.removeAttribute('data-kl-home-grid'); grid?.style.removeProperty('--kl-home-columns');
      grid = next; if (grid) resize.observe(grid);
    }
    if (grid) { grid.setAttribute('data-kl-home-grid', homeMode); updateColumns(); }
  }
  function schedule() {
    if (!timer) timer = setTimeout(() => { timer = undefined; apply(); }, 100);
  }
  chrome.storage.local.get({ commentDensity:'default', homeDensity:'default' }).then(values => {
    if (!changed.has('commentDensity')) commentMode = KarmoDensity.commentMode(values.commentDensity);
    if (!changed.has('homeDensity')) homeMode = KarmoDensity.homeMode(values.homeDensity);
    apply();
  }).catch(() => console.warn('KarmoLab: density settings could not be read'));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || (!changes.commentDensity && !changes.homeDensity)) return;
    if (changes.commentDensity) { changed.add('commentDensity'); commentMode = KarmoDensity.commentMode(changes.commentDensity.newValue); }
    if (changes.homeDensity) { changed.add('homeDensity'); homeMode = KarmoDensity.homeMode(changes.homeDensity.newValue); }
    apply();
  });
  new MutationObserver(() => {
    if (commentMode === 'compact' || (homeMode !== 'default' && location.pathname === '/' && !grid?.isConnected)) schedule();
  }).observe(document.documentElement, { childList:true, characterData:true, subtree:true });
  document.addEventListener('yt-navigate-start', () => {
    resize.disconnect(); grid?.removeAttribute('data-kl-home-grid'); grid?.style.removeProperty('--kl-home-columns'); grid = null;
  });
  document.addEventListener('yt-navigate-finish', apply);
})();
