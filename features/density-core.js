(() => {
  const commentMode = value => value === 'compact' ? 'compact' : 'default';
  const homeMode = value => ['small', 'compact'].includes(value) ? value : 'default';
  function columns(width, mode) {
    const target = mode === 'compact' ? 210 : 260;
    return Math.max(1, Math.min(8, Math.floor((Math.max(0, width - 48) + 16) / (target + 16))));
  }
  const api = { commentMode, homeMode, columns };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.KarmoDensity = api;
})();
