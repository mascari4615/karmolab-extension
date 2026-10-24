(() => {
  const commentMode = value => value === 'compact' ? 'compact' : 'default';
  const homeMode = value => ['small', 'compact'].includes(value) ? value : 'default';
  function publishedTime(value) {
    const full = String(value ?? '').trim().replace(/\s+/g, ' ');
    const text = full.replace(/\s*[（(](?:수정됨|edited)[）)]$/i, '').trim();
    return { text, edited: text !== full };
  }
  function columns(width, mode) {
    const target = mode === 'compact' ? 210 : 260;
    return Math.max(1, Math.min(8, Math.floor((Math.max(0, width - 48) + 16) / (target + 16))));
  }
  const api = { commentMode, homeMode, columns, publishedTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.KarmoDensity = api;
})();
