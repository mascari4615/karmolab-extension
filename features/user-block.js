(() => {
  const prefix = 'blockedChannel:';
  const cards = 'ytd-video-renderer,ytd-rich-item-renderer,ytd-grid-video-renderer,ytd-compact-video-renderer,yt-lockup-view-model,ytd-reel-item-renderer,yt-shorts-lockup-view-model,ytm-shorts-lockup-view-model';
  const comments = 'ytd-comment-view-model,ytd-comment-renderer';
  const shelves = 'ytd-shelf-renderer,ytd-reel-shelf-renderer,grid-shelf-view-model';
  const ownerLinks = '#channel-name a[href],ytd-channel-name a[href],a.yt-content-metadata-view-model__metadata-text[href],.yt-lockup-metadata-view-model__metadata a[href],yt-content-metadata-view-model a[href],yt-lockup-metadata-view-model a[href]';
  let records = {}, enabled = true, loaded = false, scheduled = false;
  let blockedIds = new Set(), scanned = false;
  let keywordWords = [], keywordEnabled = true;
  let keywordVideos = true, keywordShorts = true;
  const review = globalThis.KarmoFilterReview;
  const localKeys = new WeakMap();
  let keySerial = 0;
  const metadata = new Map(), queue = [];
  const exits = new Map(), moves = new WeakMap();
  const cacheKey = 'karmolab:video-owners:v1';
  try {
    for (const [id, value] of JSON.parse(sessionStorage.getItem(cacheKey) || '[]')) {
      if (/^[\w-]{11}$/.test(id) && /^UC[\w-]{22}$/.test(value?.id) && Date.now() - value.at < 86400000) metadata.set(id, value);
    }
  } catch { /* 캐시 접근 실패 시 기존 공개 정보 조회 유지 */ }
  let activeRequests = 0, clientVersion;
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
  const indexRecords = () => { blockedIds = new Set(Object.values(records).flatMap(record => record.ids || [])); };
  const blocked = id => blockedIds.has(id);
  const isShort = root => root.matches('ytd-reel-item-renderer,yt-shorts-lockup-view-model,ytm-shorts-lockup-view-model,ytd-reel-video-renderer');
  function videoId(root) {
    return root.querySelector('a[href*="/shorts/"],a[href*="/watch?"]')?.getAttribute('href')?.match(/(?:\/shorts\/|[?&]v=)([\w-]{11})/)?.[1];
  }
  function contentKey(root) {
    const id = videoId(root);
    if (id) return { key: 'video:' + id, stable: true };
    const signature = root.querySelector('#video-title,h3')?.textContent || '';
    let local = localKeys.get(root);
    if (!local || local.signature !== signature) { local = { key: 'card:local:' + (++keySerial), signature }; localKeys.set(root, local); }
    return { key: local.key, stable: false };
  }
  function titleMatches(root) {
    if (!keywordEnabled || !keywordWords.length || (isShort(root) ? !keywordShorts : !keywordVideos)) return null;
    const title = root.querySelector('#video-title,#video-title-link,h3,.yt-lockup-metadata-view-model__title,.ytLockupMetadataViewModelTitle,.shortsLockupViewModelHostMetadataTitle,.ytmShortsLockupViewModelHostMetadataTitle');
    const link = title || root.querySelector('a[href*="/watch?"][title],a[href*="/shorts/"][title]');
    return link && KarmoKeywords.match(link.getAttribute('title') || link.textContent, keywordWords);
  }
  const motion = () => scanned && document.visibilityState === 'visible' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onScreen = rect => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  function cardTarget(root) {
    const wrapper = root.closest('.ytGridShelfViewModelGridShelfItem')
      || root.closest('ytd-rich-item-renderer,ytm-shorts-lockup-view-model-v2');
    return wrapper && wrapper.querySelectorAll(cards).length === 1 ? wrapper : root;
  }
  function conceal(target, hide, className = 'kl-block-hidden') {
    const running = exits.get(target);
    if (!hide) {
      if (running) { exits.delete(target); running.cancel(); target.classList.remove('kl-block-leaving'); }
      target.classList.remove(className);
      return;
    }
    if (target.classList.contains(className) || running) return;
    if (!motion() || !onScreen(target.getBoundingClientRect()) || !target.animate) {
      target.classList.add(className); return;
    }
    // 원문은 즉시 가림, 140ms 동안 중립색 빈자리만 퇴장
    target.classList.add('kl-block-leaving');
    const animation = target.animate([
      { opacity: 1, filter: 'blur(0px)', clipPath: 'inset(0 0 0 0)' },
      { opacity: 0, filter: 'blur(2px)', clipPath: 'inset(0 0 8% 0)' },
    ], { duration: 140, easing: 'ease-out', fill: 'forwards' });
    exits.set(target, animation);
    animation.finished.then(() => {
      if (exits.get(target) !== animation) return;
      exits.delete(target);
      const container = target.closest(shelves)?.parentElement || target.parentElement;
      const candidates = container ? [...new Set([...container.querySelectorAll(cards + ',ytd-channel-renderer')].map(cardTarget))] : [];
      const positions = [];
      if (motion()) for (const item of candidates) {
        moves.get(item)?.cancel();
        const rect = item.getBoundingClientRect();
        if (item !== target && onScreen(rect) && positions.length < 24) positions.push([item, rect]);
      }
      target.classList.add(className);
      target.classList.remove('kl-block-leaving');
      animation.cancel();
      layout();
      for (const [item, before] of positions) {
        const after = item.getBoundingClientRect();
        const dx = before.x - after.x, dy = before.y - after.y;
        if (after.width && after.height && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
          moves.set(item, item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }));
        }
      }
      schedule();
    }).catch(() => { /* 차단 해제와 DOM 교체 시 이전 퇴장 취소 */ });
  }
  function videoOwner(root, resolve = false) {
    const id = videoId(root);
    if (!id) return null;
    if (!metadata.has(id) && enabled && (resolve || Object.keys(records).length)) {
      metadata.set(id, null);
      if (resolve) queue.unshift(id); else queue.push(id);
      pump();
    }
    return metadata.get(id);
  }
  function pump() {
    while (activeRequests < 3 && queue.length) {
      const id = queue.shift();
      activeRequests++;
      clientVersion ||= [...document.scripts].map(script => script.textContent.match(/"INNERTUBE_CLIENT_VERSION":"([\d.]+)"/)?.[1]).find(Boolean) || '2.20250101.00.00';
      fetch('/youtubei/v1/player?prettyPrint=false', {
        method: 'POST', credentials: 'omit', signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id, context: { client: { clientName: 'WEB', clientVersion } } }),
      }).then(response => response.ok ? response.json() : null).then(data => {
        const channel = data?.videoDetails?.channelId;
        if (/^UC[\w-]{22}$/.test(channel)) {
          metadata.set(id, { id: channel, name: data.videoDetails.author, href: 'https://www.youtube.com/channel/' + channel, at: Date.now() });
          try { sessionStorage.setItem(cacheKey, JSON.stringify([...metadata].filter(([, value]) => value).slice(-500))); } catch { /* 저장 불가 시 메모리 캐시 유지 */ }
        }
      }).catch(() => { /* 조회 실패 상태는 복구 목록에서 재시도 */ }).finally(() => {
        if (metadata.get(id) === null) metadata.set(id, false);
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
    const operation = { cancelled: false, write: Promise.resolve() };
    button._blockOperation = operation;
    button._saving = true;
    button.title = msg('blockButtonHint');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.querySelector('.kl-block-label').textContent = msg('blockSaving');
    try {
      const ids = [person.id];
      const key = prefix + person.id;
      const record = { name: person.name, ids: [...ids], created: Date.now() };
      await chrome.storage.local.set({ [key]: record });
      records[key] = record;
      indexRecords();
      scan();
      KarmoBlockUndo.show(key, record, async () => { operation.cancelled = true; await operation.write.catch(() => {}); }, () => {
        if (button._blockOperation !== operation) return;
        button._saving = false; button.disabled = false; button.removeAttribute('aria-busy');
        button.querySelector('.kl-block-label').textContent = msg('blockUser');
      });
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
      // 조회 도중 해제하거나 새로 차단한 레코드의 덮어쓰기 방지
      if (!operation.cancelled && records[key]?.created === record.created && ids.length > 1) {
        const enriched = { ...record, ids: [...new Set(ids)] };
        try {
          operation.write = chrome.storage.local.set({ [key]: enriched });
          await operation.write;
          records[key] = enriched; indexRecords(); schedule();
        } catch { /* 최초 저장한 핸들 기준 차단 유지 */ }
      }
    } catch {
      button.disabled = false;
      button.querySelector('.kl-block-label').textContent = msg('blockRetry');
      button.setAttribute('aria-label', msg('blockRetry'));
      button.title = msg('blockSaveError');
    } finally { if (button._blockOperation === operation) { button._saving = false; button.removeAttribute('aria-busy'); } schedule(); }
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
  function playback(root, person, hide = Boolean(enabled && blocked(person?.id)), message = msg('blockedPlayback')) {
    root.classList.toggle('kl-block-playback', hide);
    let notice = root.querySelector(':scope > .kl-block-notice');
    if (hide) {
      root.querySelectorAll('video').forEach(video => video.pause());
      if (!notice) {
        notice = document.createElement('div');
        notice.className = 'kl-block-notice';
        notice.setAttribute('role', 'status');
        root.append(notice);
      }
      notice.textContent = message;
    } else { notice?.remove(); }
  }
  function layout() {
    for (const shelf of document.querySelectorAll(shelves)) {
      const items = [...shelf.querySelectorAll(cards)];
      const hidden = items.filter(item => item.closest('.kl-block-hidden'));
      // 소유자 미확인 카드는 유지, 모든 카드가 차단된 묶음만 숨김
      conceal(shelf, items.length > 0 && hidden.length === items.length, 'kl-block-empty');
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
      const entries = [];
      for (const [target, animation] of exits) {
        if (!target.isConnected) { exits.delete(target); animation.cancel(); target.classList.remove('kl-block-leaving'); }
      }
      for (const root of document.querySelectorAll(cards)) {
        // Wrapper and nested lockup represent the same card, not two buttons.
        if (root.matches('ytd-rich-item-renderer') && root.querySelector(cards)) continue;
        const keywordHit = titleMatches(root);
        const direct = owner(root);
        const person = direct || (!keywordHit && videoOwner(root, onScreen(root.getBoundingClientRect())));
        const target = cardTarget(root);
        const item = contentKey(root), bypass = review?.bypass(item.key);
        const pending = Boolean(isShort(root) && enabled && blockedIds.size && videoId(root) && !direct && !person && !keywordHit && !bypass);
        const failed = pending && metadata.get(videoId(root)) === false;
        const hide = Boolean(!bypass && (keywordHit || (enabled && blocked(person?.id))));
        target.classList.toggle('kl-block-pending', pending);
        if (pending) target.setAttribute('data-kl-placeholder', msg(failed ? 'reviewFailed' : 'reviewChecking'));
        else target.removeAttribute('data-kl-placeholder');
        conceal(target, hide);
        if (hide || pending) entries.push({ ...item, root: target, kind: isShort(root) ? 'shorts' : 'video', reason: pending ? msg(failed ? 'reviewFailed' : 'reviewChecking') : (keywordHit ? msg('reviewKeyword') + ': ' + keywordHit : msg('reviewChannelBlocked')), retry: failed ? () => { metadata.delete(videoId(root)); schedule(); } : undefined });
        const anchor = root.querySelector('.ytLockupMetadataViewModelTextContainer, .yt-lockup-metadata-view-model__text-container, #meta, #metadata, .shortsLockupViewModelHostMetadata, .ytmShortsLockupViewModelHostMetadata');
        if (anchor) addButton(root, person, anchor, true, 'card');
      }
      for (const root of document.querySelectorAll('ytd-channel-renderer')) {
        const person = owner(root, 'a#main-link[href],a.channel-link[href]');
        const key = 'channel:' + person?.id;
        const hide = Boolean(enabled && blocked(person?.id) && !review?.bypass(key));
        conceal(root, hide);
        if (hide) entries.push({ root, key, stable: true, kind: 'channel', reason: msg('reviewChannelBlocked') });
        const anchor = root.querySelector('#info-section');
        if (anchor) addButton(root, person, anchor, true, 'card');
      }
      layout();
      for (const root of document.querySelectorAll(comments)) {
        const person = owner(root, 'a#author-text[href]');
        // 차단한 부모 댓글은 답글까지 숨김, 답글 작성자 차단은 해당 답글만
        const target = root.closest('ytd-comment-thread-renderer')?.querySelector(comments) === root
          ? root.closest('ytd-comment-thread-renderer') : root;
        const item = review?.comment(root);
        const hide = Boolean(enabled && blocked(person?.id) && !review?.bypass(item?.key));
        conceal(target, hide);
        if (hide && item) entries.push({ ...item, root: target, kind: 'comment', reason: msg('reviewChannelBlocked') });
        const actions = root.querySelector('#action-buttons #toolbar') || root.querySelector('#action-buttons');
        addButton(root, person, actions || root.querySelector('#main') || root, true, 'comment');
      }
      for (const root of document.querySelectorAll('ytd-reel-video-renderer')) {
        const person = owner(root, 'a[href^="/@"],a[href^="/channel/"]') || videoOwner(root);
        const item = contentKey(root), bypass = review?.bypass(item.key);
        const pending = Boolean(enabled && blockedIds.size && videoId(root) && !person && !bypass);
        const failed = pending && metadata.get(videoId(root)) === false;
        const hide = Boolean(!bypass && (pending || (enabled && blocked(person?.id))));
        const subscribe = root.querySelector('.ytReelChannelBarViewModelReelSubscribeButton, #subscribe-button, ytd-subscribe-button-renderer');
        const bar = root.querySelector('yt-reel-channel-bar-view-model');
        const anchor = subscribe || bar;
        if (anchor) addButton(root, person, anchor, !subscribe, 'shorts');
        playback(root, person, hide, pending ? msg(failed ? 'reviewFailed' : 'reviewChecking') : msg('blockedPlayback'));
        if (hide) entries.push({ ...item, root, kind: 'shorts', reason: pending ? msg(failed ? 'reviewFailed' : 'reviewChecking') : msg('reviewChannelBlocked'), retry: failed ? () => { metadata.delete(videoId(root)); schedule(); } : undefined });
      }
      const watch = document.querySelector('ytd-watch-flexy');
      if (watch) {
        const ownerRoot = watch.querySelector('ytd-video-owner-renderer');
        const person = ownerRoot && owner(ownerRoot, 'a[href]');
        const ownerArea = watch.querySelector('#owner') || ownerRoot;
        const anchor = ownerArea?.querySelector('#subscribe-button, ytd-subscribe-button-renderer, yt-subscribe-button-view-model');
        if (anchor) addButton(ownerArea, person, anchor);
        const player = watch.querySelector('#player');
        if (player) {
          const id = new URL(location.href).searchParams.get('v');
          const key = 'video:' + id;
          const hide = Boolean(enabled && blocked(person?.id) && !review?.bypass(key));
          playback(player, person, hide);
          if (hide) entries.push({ root: player, key, stable: Boolean(id), kind: 'video', reason: msg('reviewChannelBlocked') });
        }
      }
      review?.set('users-and-titles', entries);
    } finally {
      scanned = true;
      observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href', 'title', 'aria-label'] });
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; scan(); }, 32);
  }
  const observedContent = cards + ',' + comments + ',' + shelves + ',ytd-channel-renderer,ytd-reel-video-renderer,ytd-watch-flexy';
  const observer = new MutationObserver(changes => {
    if (changes.some(change => (change.target.nodeType === 1 ? change.target : change.target.parentElement)?.closest(observedContent)
      || [...change.addedNodes, ...change.removedNodes].some(node => node.nodeType === 1 && (node.matches(observedContent) || node.querySelector(observedContent))))) schedule();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let relevant = false;
    for (const [key, change] of Object.entries(changes)) {
      if (key === 'userBlock') { enabled = change.newValue !== false; relevant = true; }
      if (key === 'keywordEnabled') { keywordEnabled = change.newValue !== false; relevant = true; }
      if (key === 'keywordVideos') { keywordVideos = change.newValue !== false; relevant = true; }
      if (key === 'keywordShorts') { keywordShorts = change.newValue !== false; relevant = true; }
      if (key === 'keywordWords') { keywordWords = globalThis.KarmoKeywords?.parse((change.newValue || []).join('\n')) || []; relevant = true; }
      if (key.startsWith(prefix)) {
        relevant = true;
        if (change.newValue) records[key] = change.newValue;
        else delete records[key];
      }
    }
    if (relevant) { indexRecords(); schedule(); }
  });
  document.addEventListener('yt-navigate-finish', schedule);
  review?.onChange(schedule);
  document.addEventListener('play', event => {
    if (event.target.closest?.('.kl-block-playback')) event.target.pause();
  }, true);
  chrome.storage.local.get(null).then(async values => {
    await review?.ready;
    records = Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith(prefix)));
    indexRecords();
    enabled = values.userBlock !== false;
    keywordEnabled = values.keywordEnabled !== false;
    keywordVideos = values.keywordVideos !== false;
    keywordShorts = values.keywordShorts !== false;
    keywordWords = globalThis.KarmoKeywords?.parse((values.keywordWords || []).join('\n')) || [];
    loaded = true;
    scan();
  }).catch(() => console.error('KarmoLab: ' + msg('blockLoadError')));
})();
