(() => {
  const commentMode = value => value === 'compact' ? 'compact' : 'default';
  const homeMode = value => ['small', 'compact', 'custom'].includes(value) ? value : 'default';
  const ranges = { commentFontSize:[12,20,1,15], commentLineHeight:[18,32,2,22], homeColumns:[2,6,1,4] };
  function number(key, value) {
    const [min,max,step,fallback] = ranges[key];
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max,Math.max(min,min+Math.round((value-min)/step)*step)) : fallback;
  }
  function publishedTime(value) {
    const full = String(value ?? '').trim().replace(/\s+/g, ' ');
    const text = full.replace(/\s*[（(](?:수정됨|edited)[）)]$/i, '').trim();
    return { text, edited: text !== full };
  }
  function homeChoice(values) {
    const mode = homeMode(values.homeDensity);
    const legacy = mode === 'compact' ? 6 : mode === 'custom' && values.homeCardWidth > 300 ? 3 : mode === 'custom' && values.homeCardWidth <= 220 ? 6 : 4;
    return { homeDensity:mode === 'default' ? 'default' : 'custom', homeColumns:number('homeColumns',values.homeColumns ?? legacy) };
  }
  function columns(width, mode, count) {
    const requested = homeChoice({homeDensity:mode,homeColumns:count}).homeColumns;
    const capacity = Math.max(1,Math.floor((Math.max(0,width-48)+16)/196));
    return Math.min(requested,capacity);
  }
  const api = { commentMode, homeMode, columns, publishedTime, ranges, number, homeChoice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.KarmoDensity = api;
})();
