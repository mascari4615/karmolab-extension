(() => {
  function read(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeName === 'IMG') {
      const alt = node.getAttribute('alt');
      if (alt) return alt;
      const code = node.getAttribute('src')?.match(/emoji_u([\da-f_]+)\./i)?.[1];
      if (code) {
        const points = code.split('_').map(value => parseInt(value, 16));
        if (points.every(value => value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff))) return String.fromCodePoint(...points);
      }
      return node.getAttribute('aria-label') || '';
    }
    return [...node.childNodes].map(read).join('');
  }
  globalThis.KarmoCommentText = { read };
})();
