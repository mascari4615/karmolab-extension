(() => {
  const prefix = 'blockedChannel:';
  const cards = 'ytd-video-renderer,ytd-rich-item-renderer,ytd-grid-video-renderer,ytd-compact-video-renderer,yt-lockup-view-model,ytd-reel-item-renderer,yt-shorts-lockup-view-model,ytm-shorts-lockup-view-model';
  const comments = 'ytd-comment-view-model,ytd-comment-renderer';
  const shelves = 'ytd-shelf-renderer,ytd-reel-shelf-renderer,grid-shelf-view-model';
  const ownerLinks = '#channel-name a[href],ytd-channel-name a[href],a.yt-content-metadata-view-model__metadata-text[href],.yt-lockup-metadata-view-model__metadata a[href],yt-content-metadata-view-model a[href],yt-lockup-metadata-view-model a[href]';
  let records = {}, enabled = true, loaded = false, scheduled = false;
  const metadata = new Map(), queue = [];
  let activeRequests = 0;
  const msg = key => chrome.i18n.getMessage(key);

  function identity(href) {
    try {
      const url = new URL(href, location.origin);
      if (url.origin !== 'https://www.youtube.com') return null;
      const path = decodeURIComponent(url.pathname).replace(/\/+$/, '');
      const match = path.match(/^\/(?:channel\/(UC[\w-]{22})|(@[^/]+))(?:\/.*)?$/);
      return match ? (match[1] || match[2].toLowerCase()) : null;
    } catch { return null; }
  }
  const blocked = id => id && Object.values(records).some(record => record.ids?.includes(id));
  function videoOwner(root, resolve = false) {
    const link = root.querySelector('a[href*="/shorts/"],a[href*="/watch?"]');
    const id = link?.getAttribute('href')?.match(/(?:\/shorts\/|[?&]v=)([\w-]{11})/)?.[1];
    if (!id) return null;
    if (!metadata.has(id) && enabled && (resolve || Object.keys(records).length)) {
      metadata.set(id, null);
      queue.push(id);
      pump();
    }
    return metadata.get(id);
  }
  function pump() {
    while (activeRequests < 3 && queue.length) {
      const id = queue.shift();
      activeRequests++;
      const version = [...document.scripts].map(script => script.textContent.match(/"INNERTUBE_CLIENT_VERSION":"([\d.]+)"/)?.[1]).find(Boolean) || '2.20250101.00.00';
      fetch('/youtubei/v1/player?prettyPrint=false', {
        method: 'POST', credentials: 'omit', signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id, context: { client: { clientName: 'WEB', clientVersion: version } } }),
      }).then(response => response.ok ? response.json() : null).then(data => {
        const channel = data?.videoDetails?.channelId;
        if (channel) metadata.set(id, { id: channel, name: data.videoDetails.author, href: 'https://www.youtube.com/channel/' + channel });
      }).catch(() => { /* Keep unknown authors visible when metadata is unavailable. */ }).finally(() => {
        activeRequests--; schedule(); pump();
      });
    }
  }
  function owner(root, selector = ownerLinks) {
    for (const link of root.querySelectorAll(selector)) {
      const id = identity(link.getAttribute('href'));
      if (id) return { id, name: link.textContent.trim() || id, href: link.href };
    }
    return null;
  }
  async function addBlock(person, button) {
    button._saving = true;
    button.title = msg('blockButtonHint');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.querySelector('.kl-block-label').textContent = msg('blockSaving');
    try {
      const ids = [person.id];
      // 핸들과 채널 ID 연결. 실패해도 선택한 링크 기준 차단 유지
      try {
        const response = await fetch(person.href, { credentials: 'omit', signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const html = await response.text();
          const channel = html.match(/"externalId"\s*:\s*"(UC[\w-]{22})"/)?.[1]
            || html.match(/<link[^>]+href="https:\/\/www.youtube.com\/channel\/(UC[\w-]{22})"/)?.[1];
          if (channel) ids.push(channel);
          const handle = html.match(/"vanityChannelUrl"\s*:\s*"https?:\/\/www.youtube.com\/(@[^"/]+)"/)?.[1];
          if (handle) ids.push(decodeURIComponent(handle).toLowerCase());
        }
      } catch { /* 오프라인에서도 링크 기준 차단 */ }
      const key = prefix + person.id;
      const record = { name: person.name, ids: [...new Set(ids)], created: Date.now() };
      await chrome.storage.local.set({ [key]: record });
      records[key] = record;
      scan();
    } catch {
      button.disabled = false;
      button.querySelector('.kl-block-label').textContent = msg('blockRetry');
      button.setAttribute('aria-label', msg('blockRetry'));
      button.title = msg('blockSaveError');
    } finally { button._saving = false; button.removeAttribute('aria-busy'); schedule(); }
  }
  function addButton(root, person, anchor, inside = false, variant = 'channel') {
    let button = root.querySelector(':scope .kl-block-button');
    if (!person || !enabled) { button?.remove(); return; }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'kl-block-button kl-block-button--' + variant;
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '1.8');
      const circle = document.createElementNS(icon.namespaceURI, 'circle');
      circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '8');
      const slash = document.createElementNS(icon.namespaceURI, 'path');
      slash.setAttribute('d', 'M6.4 6.4 17.6 17.6');
      icon.append(circle, slash);
      const label = document.createElement('span');
      label.className = 'kl-block-label';
      label.textContent = msg('blockUser');
      button.append(icon, label);
      button.title = msg('blockButtonHint');
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        const current = button._person;
        if (current && confirm(chrome.i18n.getMessage('blockConfirm', current.name))) addBlock(current, button);
      });
    }
    if (inside) {
      if (button.parentElement !== anchor) anchor.append(button);
    } else if (anchor.nextElementSibling !== button) { anchor.after(button); }
    button._person = person;
    if (!button._saving && button.disabled && !blocked(person.id)) {
      button.disabled = false;
      button.querySelector('.kl-block-label').textContent = msg('blockUser');
    }
    if (!button.title.includes(msg('blockSaveError'))) button.setAttribute('aria-label', msg('blockUser') + ': ' + person.name);
  }
  function playback(root, person) {
    const hide = Boolean(enabled && blocked(person?.id));
    root.classList.toggle('kl-block-playback', hide);
    let notice = root.querySelector(':scope > .kl-block-notice');
    if (hide) {
      root.querySelectorAll('video').forEach(video => video.pause());
      if (!notice) {
        notice = document.createElement('div');
        notice.className = 'kl-block-notice';
        notice.setAttribute('role', 'status');
        notice.textContent = msg('blockedPlayback');
        root.append(notice);
      }
    } else { notice?.remove(); }
  }
  function layout() {
    for (const shelf of document.querySelectorAll(shelves)) {
      const items = [...shelf.querySelectorAll(cards)];
      const hidden = items.filter(item => item.closest('.kl-block-hidden'));
      // 소유자 미확인 카드는 유지, 모든 카드가 차단된 묶음만 숨김
      shelf.classList.toggle('kl-block-empty', items.length > 0 && hidden.length === items.length);
      const reflow = shelf.matches('grid-shelf-view-model') && hidden.length > 0;
      const rows = [...shelf.querySelectorAll('.ytGridShelfViewModelGridShelfRow')];
      for (const parent of new Set(rows.map(row => row.parentElement))) {
        parent.classList.toggle('kl-block-grid', reflow);
      }
    }
  }
  function scan() {
    if (!loaded) return;
    observer.disconnect();
    try {
      for (const root of document.querySelectorAll(cards)) {
        // Wrapper and nested lockup represent the same card, not two buttons.
        if (root.matches('ytd-rich-item-renderer') && root.querySelector(cards)) continue;
        const direct = owner(root);
        const rect = root.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
        const person = direct || videoOwner(root, visible);
        const wrapper = root.closest('.ytGridShelfViewModelGridShelfItem')
          || root.closest('ytd-rich-item-renderer,ytm-shorts-lockup-view-model-v2');
        const target = wrapper && wrapper.querySelectorAll(cards).length === 1 ? wrapper : root;
        target.classList.toggle('kl-block-hidden', Boolean(enabled && blocked(person?.id)));
        const anchor = root.querySelector('.ytLockupMetadataViewModelTextContainer, .yt-lockup-metadata-view-model__text-container, #meta, #metadata, .shortsLockupViewModelHostMetadata, .ytmShortsLockupViewModelHostMetadata');
        if (anchor) addButton(root, person, anchor, true, 'card');
      }
      for (const root of document.querySelectorAll('ytd-channel-renderer')) {
        const person = owner(root, 'a#main-link[href],a.channel-link[href]');
        root.classList.toggle('kl-block-hidden', Boolean(enabled && blocked(person?.id)));
        const anchor = root.querySelector('#info-section');
        if (anchor) addButton(root, person, anchor, true, 'card');
      }
      layout();
      for (const root of document.querySelectorAll(comments)) {
        const person = owner(root, 'a#author-text[href]');
        // 차단한 부모 댓글은 답글까지 숨김, 답글 작성자 차단은 해당 답글만
        const target = root.closest('ytd-comment-thread-renderer')?.querySelector(comments) === root
          ? root.closest('ytd-comment-thread-renderer') : root;
        target.classList.toggle('kl-block-hidden', Boolean(enabled && blocked(person?.id)));
        const actions = root.querySelector('#action-buttons #toolbar') || root.querySelector('#action-buttons');
        addButton(root, person, actions || root.querySelector('#main') || root, true, 'comment');
      }
      for (const root of document.querySelectorAll('ytd-reel-video-renderer')) {
        const person = owner(root, 'a[href^="/@"],a[href^="/channel/"]') || videoOwner(root);
        const subscribe = root.querySelector('.ytReelChannelBarViewModelReelSubscribeButton, #subscribe-button, ytd-subscribe-button-renderer');
        const bar = root.querySelector('yt-reel-channel-bar-view-model');
        const anchor = subscribe || bar;
        if (anchor) addButton(root, person, anchor, !subscribe, 'shorts');
        playback(root, person);
      }
      const watch = document.querySelector('ytd-watch-flexy');
      if (watch) {
        const ownerRoot = watch.querySelector('ytd-video-owner-renderer');
        const person = ownerRoot && owner(ownerRoot, 'a[href]');
        const ownerArea = watch.querySelector('#owner') || ownerRoot;
        const anchor = ownerArea?.querySelector('#subscribe-button, ytd-subscribe-button-renderer, yt-subscribe-button-view-model');
        if (anchor) addButton(ownerArea, person, anchor);
        const player = watch.querySelector('#player');
        if (player) playback(player, person);
      }
    } finally {
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; scan(); }, 100);
  }
  const observer = new MutationObserver(schedule);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) {
      if (key === 'userBlock') enabled = change.newValue !== false;
      if (key.startsWith(prefix)) {
        if (change.newValue) records[key] = change.newValue;
        else delete records[key];
      }
    }
    schedule();
  });
  document.addEventListener('yt-navigate-finish', schedule);
  document.addEventListener('play', event => {
    if (event.target.closest?.('.kl-block-playback')) event.target.pause();
  }, true);
  chrome.storage.local.get(null).then(values => {
    records = Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith(prefix)));
    enabled = values.userBlock !== false;
    loaded = true;
    scan();
  }).catch(() => console.error('KarmoLab: ' + msg('blockLoadError')));
})();
