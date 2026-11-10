(() => {
  const cache = new Map();
  const rect = (fill, x, y, w, h) => `<path fill="${fill}" d="M${x} ${y}h${w}v${h}H${x}z"/>`;
  const horizontal = colors => colors.map((color, i) => rect(color, 0, i * 16 / colors.length, 24, 16 / colors.length)).join('');
  const vertical = colors => colors.map((color, i) => rect(color, i * 24 / colors.length, 0, 24 / colors.length, 16)).join('');
  const stripes = { de:['#111','#d00','#fc0'], ru:['#fff','#1645b5','#d22'], uk:['#0868c9','#ffd700'], nl:['#ae1c28','#fff','#21468b'], pl:['#fff','#dc143c'], id:['#e22','#fff'], hu:['#ce2939','#fff','#477050'], bg:['#fff','#00966e','#d62612'], et:['#4891d9','#111','#fff'], lt:['#fdb913','#006a44','#c1272d'], lv:['#9e1b34','#fff','#9e1b34'], es:['#aa151b','#f1bf00','#f1bf00','#aa151b'], th:['#a51931','#fff','#2d2a4a','#2d2a4a','#fff','#a51931'] };
  const flags = Object.fromEntries(Object.entries(stripes).map(([code, colors]) => [code, horizontal(colors)]));
  Object.assign(flags, { fr:vertical(['#002395','#fff','#ed2939']), it:vertical(['#009246','#fff','#ce2b37']), ro:vertical(['#002b7f','#fcd116','#ce1126']), ja:rect('#fff',0,0,24,16)+'<circle cx="12" cy="8" r="4.5" fill="#bc002d"/>', bn:rect('#006a4e',0,0,24,16)+'<circle cx="11" cy="8" r="4.5" fill="#f42a41"/>', en:rect('#012169',0,0,24,16)+'<path stroke="#fff" stroke-width="4" d="m0 0 24 16M0 16 24 0"/><path stroke="#c8102e" stroke-width="1.5" d="m0 0 24 16M0 16 24 0"/>'+rect('#fff',9,0,6,16)+rect('#fff',0,5,24,6)+rect('#c8102e',10,0,4,16)+rect('#c8102e',0,6,24,4), hi:horizontal(['#ff9933','#fff','#138808'])+'<circle cx="12" cy="8" r="2" fill="none" stroke="#000080" stroke-width=".8"/>' });
  for (const [code, bg, cross] of [['sv','#006aa7','#fecc00'],['da','#c60c30','#fff'],['fi','#fff','#003580']]) flags[code] = rect(bg,0,0,24,16)+rect(cross,7,0,3,16)+rect(cross,0,6,24,3);
  const star = '<path fill="#ffde00" d="m12 3 1.2 3.5H17l-3 2.2 1.2 3.6-3.2-2.2-3.2 2.2L10 8.7 7 6.5h3.8z"/>';
  flags.vi = rect('#da251d',0,0,24,16)+star;
  const names = new Intl.DisplayNames([chrome.i18n.getUILanguage?.() || 'ko'], { type:'language' });
  function describe(code, source) {
    try {
      const locale = new Intl.Locale(code.replaceAll('_','-')), base = locale.language;
      if (!base || ['und','zxx'].includes(base)) return { code:'', name:'원문 언어 미확인', source:'unknown' };
      return { code:locale.toString(), name:names.of(locale.toString()) || locale.toString(), source, flag:flags[base] ? `<svg viewBox="0 0 24 16" width="18" height="12" aria-hidden="true">${flags[base]}</svg>` : '' };
    } catch { return { code:'', name:'원문 언어 미확인', source:'unknown' }; }
  }
  async function detect(text, explicit) {
    if (explicit) { const result = describe(explicit, 'declared'); if (result.code) return result; }
    const input = String(text || '').slice(0, 4000).trim();
    if (!/\p{L}/u.test(input) || input.length < 4) return describe('und','unknown');
    if (!cache.has(input)) {
      const job = Promise.resolve().then(() => chrome.i18n.detectLanguage(input)).then(result => {
        const top = result.languages?.filter(item => item.language !== 'und').sort((a,b) => b.percentage-a.percentage)[0];
        return result.isReliable && top?.percentage >= 80 ? describe(top.language,'detected') : describe('und','unknown');
      }).catch(() => describe('und','unknown'));
      cache.set(input, job); if (cache.size > 300) cache.delete(cache.keys().next().value);
    }
    return cache.get(input);
  }
  globalThis.KarmoCommentLanguage = { detect, describe };
})();
