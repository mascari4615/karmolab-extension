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
      entry.append(link.token);
      const anchor = document.createElement('a');
      anchor.className = 'kl-base64-link';
      anchor.href = link.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.referrerPolicy = 'no-referrer';
      anchor.title = link.href;
      anchor.textContent = chrome.i18n.getMessage('base64Open', link.hostname);
      anchor.setAttribute('aria-label', chrome.i18n.getMessage('base64Open', link.href));
      entry.append(anchor);
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
      for (const entry of document.querySelectorAll('.kl-base64-entry')) entry.replaceWith(entry.firstChild);
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.base64Sites) setEnabled((changes.base64Sites.newValue || []).includes(pattern));
  });
  chrome.storage.local.get({ base64Sites: [] }).then(v => setEnabled(v.base64Sites.includes(pattern))).catch(() => {});
})();
