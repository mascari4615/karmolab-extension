(() => {
  let commentMode = 'default', homeMode = 'default', grid, timer;
  const changed = new Set();
  const sizes = Object.fromEntries(Object.keys(KarmoDensity.ranges).map(key => [key,KarmoDensity.number(key)]));
  const keys = ['commentDensity','homeDensity',...Object.keys(sizes)];
  const homeListeners = new Set();
  let homeLoaded = false, homeError = false, homePending = 0, homeRevision = 0;
  let homeSaved = {homeDensity:'default',homeColumns:4}, homeQueue = Promise.resolve();
  const resize = new ResizeObserver(updateColumns);
  function updateColumns() {
    if (!grid || homeMode === 'default') return;
    const value = String(KarmoDensity.columns(grid.getBoundingClientRect().width, homeMode, sizes.homeColumns));
    if (grid.style.getPropertyValue('--kl-home-columns') !== value) grid.style.setProperty('--kl-home-columns', value);
    notifyHome();
  }
  function homeState() {
    return { homeDensity:homeMode, homeColumns:sizes.homeColumns, actual: grid ? Number(grid.style.getPropertyValue('--kl-home-columns')) : null, loaded:homeLoaded, error:homeError };
  }
  function notifyHome() { for (const listener of homeListeners) listener(homeState()); }
  function apply() {
    document.documentElement.dataset.klCommentDensity = commentMode;
    document.documentElement.toggleAttribute('data-kl-on-shorts',location.pathname.startsWith('/shorts/'));
    document.documentElement.style.setProperty('--kl-comment-font-size', sizes.commentFontSize + 'px');
    document.documentElement.style.setProperty('--kl-comment-line-height', Math.max(sizes.commentLineHeight,sizes.commentFontSize+4) + 'px');
    if (commentMode === 'compact') {
      for (const control of document.querySelectorAll('ytd-comment-view-model #author-thumbnail-button,ytd-comment-renderer #author-thumbnail')) {
        const label = control.getAttribute('aria-label') || control.closest('ytd-comment-view-model,ytd-comment-renderer')?.querySelector('#author-text')?.textContent.trim();
        if (label && (!control.title || control.title === control.dataset.klProfileTitle)) {
          control.title = label;
          control.dataset.klProfileTitle = label;
        }
      }
      for (const link of document.querySelectorAll('ytd-comment-view-model #published-time-text a,ytd-comment-renderer #published-time-text a')) {
        const value = KarmoDensity.publishedTime(link.textContent);
        if (link.dataset.klDate !== value.text) link.dataset.klDate = value.text;
        if(!link.title||link.title===link.dataset.klDateTitle){link.title=link.textContent.trim();link.dataset.klDateTitle=link.title;}
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
    else notifyHome();
  }
  function schedule() {
    if (!timer) timer = setTimeout(() => { timer = undefined; apply(); }, 100);
  }
  globalThis.KarmoDensityLayout = { preview(patch) {
    for (const key of keys) if (Object.hasOwn(patch,key)) changed.add(key);
    if (patch.commentDensity !== undefined) commentMode = KarmoDensity.commentMode(patch.commentDensity);
    if (patch.homeDensity !== undefined) homeMode = KarmoDensity.homeMode(patch.homeDensity);
    for (const key of Object.keys(sizes)) if (Object.hasOwn(patch,key)) sizes[key] = KarmoDensity.number(key,patch[key]);
    apply();
  }, subscribeHome(listener) { homeListeners.add(listener); listener(homeState()); return ()=>homeListeners.delete(listener); },
  selectHome(mode,count) {
    const patch = KarmoDensity.homeChoice({ homeDensity:mode,homeColumns:count });
    const revision = ++homeRevision;
    homePending++; homeError = false;
    globalThis.KarmoDensityLayout.preview(patch);
    const job = homeQueue.then(async()=> {
      try { await chrome.storage.local.set(patch); homeSaved = patch; }
      catch (error) {
        if (revision === homeRevision) { homeError=true; globalThis.KarmoDensityLayout.preview(homeSaved); }
        throw error;
      } finally { homePending--; notifyHome(); }
    });
    homeQueue = job.catch(()=>{});
    return job;
  } };
  chrome.storage.local.get({ commentDensity:'default', homeDensity:'default', ...sizes, homeColumns:null, homeCardWidth:null }).then(values => {
    if (!changed.has('commentDensity')) commentMode = KarmoDensity.commentMode(values.commentDensity);
    const choice = KarmoDensity.homeChoice(values);
    if (!changed.has('homeDensity')) homeMode = choice.homeDensity;
    for (const key of Object.keys(sizes)) if (!changed.has(key)) sizes[key] = key === 'homeColumns' ? choice.homeColumns : KarmoDensity.number(key,values[key]);
    homeSaved = {homeDensity:homeMode,homeColumns:sizes.homeColumns}; homeLoaded = true;
    apply();
  }).catch(() => { homeError=true; notifyHome(); console.warn('KarmoLab: density settings could not be read'); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !keys.some(key => changes[key])) return;
    if (changes.commentDensity) { changed.add('commentDensity'); commentMode = KarmoDensity.commentMode(changes.commentDensity.newValue); }
    if (changes.homeDensity || changes.homeColumns) {
      const legacyMode = ['small','compact'].includes(changes.homeDensity?.newValue);
      const choice = KarmoDensity.homeChoice({homeDensity:changes.homeDensity ? changes.homeDensity.newValue : homeSaved.homeDensity, homeColumns:changes.homeColumns ? changes.homeColumns.newValue : legacyMode ? undefined : homeSaved.homeColumns});
      homeSaved = choice;
      changed.add('homeDensity'); changed.add('homeColumns');
      if (!homePending) { homeMode=choice.homeDensity; sizes.homeColumns=choice.homeColumns; homeError=false; }
    }
    for (const key of Object.keys(sizes)) if (key !== 'homeColumns' && changes[key]) { changed.add(key); sizes[key] = KarmoDensity.number(key,changes[key].newValue); }
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
