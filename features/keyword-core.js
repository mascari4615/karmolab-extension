(() => {
  const normalize = text => String(text).normalize('NFKC').toLowerCase().replace(/\ufe0f/g, '').replace(/\s+/g, ' ').trim();
  function merge(...lists) {
    const unique = new Map();
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const value of list) {
        if (typeof value !== 'string') continue;
        const word = value.trim();
        const key = word.startsWith('re:') ? word : normalize(word);
        if (key && !unique.has(key)) unique.set(key, word);
      }
    }
    return [...unique.values()];
  }
  function parse(text) {
    const words = String(text).split(/\r?\n/).map(word => word.trim());
    if (words.some(word => word.length > 200)) throw new Error('Keyword too long');
    const unique = merge(words);
    if (unique.length > 200) throw new Error('Too many keywords');
    return unique;
  }
  const match = (text, words) => { const value = normalize(text); return words.find(word => value.includes(normalize(word))) || null; };
  const api = { normalize, parse, merge, match };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.KarmoKeywords = api;
})();
