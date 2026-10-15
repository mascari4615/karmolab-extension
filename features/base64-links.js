(() => {
  if (globalThis.karmoBase64Started) return;
  globalThis.karmoBase64Started = true;
  const pattern = `${location.protocol}//${location.hostname}/*`;
  const excluded = 'a,button,input,textarea,select,option,script,style,noscript,pre,code,svg,math,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[hidden],[aria-hidden="true"],.kl-base64-entry';
  let enabled = false;
  let frame = 0;
  const pending = new Set();
  let walker = null;
  let cursor = null;
  let nextId = 0;
  function icon(paths) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  function linkify(node) {
    if (!node.isConnected || !node.parentElement || node.parentElement.closest(excluded)) return;
    const text = node.nodeValue;
    if (text.length < 16 || text.length > 65536) return;
    const links = KarmoBase64.findLinks(text);
    if (!links.length) return;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const link of links) {
      fragment.append(text.slice(offset, link.start));
      const entry = document.createElement('span');
      entry.className = 'kl-base64-entry';
      const original = document.createElement('span');
      original.className = 'kl-base64-original';
      original.textContent = link.token;
      original.hidden = true;
      original.id = 'kl-base64-original-' + ++nextId;
      const anchor = document.createElement('a');
      anchor.className = 'kl-base64-link';
      anchor.href = link.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.referrerPolicy = 'no-referrer';
      anchor.title = link.href;
      anchor.append(icon(['M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7', 'M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7']));
      const domain = document.createElement('span');
      domain.textContent = link.hostname;
      anchor.append(domain);
      anchor.setAttribute('aria-label', chrome.i18n.getMessage('base64Open', link.href));
      const reveal = document.createElement('button');
      reveal.type = 'button';
      reveal.className = 'kl-base64-reveal';
      reveal.setAttribute('aria-expanded', 'false');
      reveal.setAttribute('aria-controls', original.id);
      reveal.setAttribute('aria-label', chrome.i18n.getMessage('base64ShowOriginal'));
      reveal.title = chrome.i18n.getMessage('base64ShowOriginal');
      reveal.append(icon(['m8 10 4 4 4-4']));
      reveal.addEventListener('click', event => {
        event.stopPropagation();
        original.hidden = !original.hidden;
        reveal.setAttribute('aria-expanded', String(!original.hidden));
        const label = chrome.i18n.getMessage(original.hidden ? 'base64ShowOriginal' : 'base64HideOriginal');
        reveal.setAttribute('aria-label', label);
        reveal.title = label;
      });
      const target = document.createElement('span');
      target.className = 'kl-base64-target';
      target.append(anchor, reveal);
      entry.append(target, original);
      fragment.append(entry);
      offset = link.start + link.token.length;
    }
    fragment.append(text.slice(offset));
    node.replaceWith(fragment);
  }

  function flush() {
    frame = 0;
    if (!enabled) return;
    const until = performance.now() + 8;
    while (performance.now() < until) {
      if (!walker) {
        const root = pending.values().next().value;
        if (!root) break;
        pending.delete(root);
        if (!root.isConnected) continue;
        if (root.nodeType === Node.TEXT_NODE) { linkify(root); continue; }
        if (root.nodeType !== Node.ELEMENT_NODE || root.closest(excluded)) continue;
        walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        cursor = walker.nextNode();
      }
      const node = cursor;
      if (!node) { walker = null; continue; }
      // Save traversal before replacing the current text node.
      cursor = walker.nextNode();
      linkify(node);
      if (!cursor) walker = null;
    }
    if (pending.size || walker) frame = requestAnimationFrame(flush);
  }

  function enqueue(node) {
    if (node.parentElement?.closest('.kl-base64-entry')) return;
    pending.add(node);
    if (!frame) frame = requestAnimationFrame(flush);
  }
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') enqueue(record.target);
      else for (const node of record.addedNodes) enqueue(node);
    }
  });
  function setEnabled(value) {
    if (enabled === value) return;
    enabled = value;
    observer.disconnect();
    cancelAnimationFrame(frame);
    frame = 0;
    walker = null;
    cursor = null;
    pending.clear();
    if (enabled) {
      observer.observe(document.body, { childList: true, characterData: true, subtree: true });
      enqueue(document.body);
    } else {
      for (const entry of document.querySelectorAll('.kl-base64-entry')) {
        entry.replaceWith(document.createTextNode(entry.querySelector('.kl-base64-original').textContent));
      }
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.base64Sites) setEnabled((changes.base64Sites.newValue || []).includes(pattern));
  });
  chrome.storage.local.get({ base64Sites: [] }).then(v => setEnabled(v.base64Sites.includes(pattern))).catch(() => {});
})();
