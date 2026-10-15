(() => {
  const normalize = text => String(text).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  function parse(text) {
    const unique = new Map();
    for (const word of String(text).split(/\r?\n/).map(word => word.trim()).filter(Boolean)) {
      if (word.length > 200) throw new Error('Keyword too long');
      if (!unique.has(normalize(word))) unique.set(normalize(word), word);
    }
    if (unique.size > 200) throw new Error('Too many keywords');
    return [...unique.values()];
  }
  const match = (text, words) => { const value = normalize(text); return words.find(word => value.includes(normalize(word))) || null; };
  const api = { normalize, parse, match };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.KarmoKeywords = api;
})();
