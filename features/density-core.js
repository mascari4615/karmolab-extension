(() => {
  const commentMode = value => value === 'compact' ? 'compact' : 'default';
  const homeMode = value => ['small', 'compact', 'custom'].includes(value) ? value : 'default';
  const ranges = { commentFontSize:[12,20,1,15], commentLineHeight:[18,32,2,22], homeCardWidth:[180,400,10,260] };
  function number(key, value) {
    const [min,max,step,fallback] = ranges[key];
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max,Math.max(min,min+Math.round((value-min)/step)*step)) : fallback;
  }
  function publishedTime(value) {
    const full = String(value ?? '').trim().replace(/\s+/g, ' ');
    const text = full.replace(/\s*[（(](?:수정됨|edited)[）)]$/i, '').trim();
    return { text, edited: text !== full };
  }
  function columns(width, mode, cardWidth) {
    const target = mode === 'custom' ? number('homeCardWidth',cardWidth) : mode === 'compact' ? 210 : 260;
    return Math.max(1, Math.min(8, Math.floor((Math.max(0, width - 48) + 16) / (target + 16))));
  }
  const api = { commentMode, homeMode, columns, publishedTime, ranges, number };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.KarmoDensity = api;
})();
