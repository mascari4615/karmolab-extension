// Shared by the isolated content script and Node tests. No network requests.
(() => {
  function decodeUrl(token) {
    if (token.length < 16 || token.length > 8192 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(token)) return null;
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const bare = normalized.replace(/=+$/, '');
    if (bare.length % 4 === 1 || (normalized.includes('=') && normalized.length % 4 !== 0)) return null;
    try {
      const binary = atob(bare);
      if (btoa(binary).replace(/=+$/, '') !== bare) return null;
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
      if (!/^https?:\/\//i.test(decoded) || /[\s\p{Cc}\p{Cf}\\]/u.test(decoded)) return null;
      const url = new URL(decoded);
      if (!url.hostname || url.username || url.password) return null;
      return { href: url.href, hostname: url.hostname };
    } catch { return null; }
  }

  function findLinks(text) {
    const results = [];
    const tokens = /(?<![A-Za-z0-9+/_=-])[A-Za-z0-9+/_-]{16,}={0,2}(?![A-Za-z0-9+/_=-])/g;
    for (const match of text.matchAll(tokens)) {
      const url = decodeUrl(match[0]);
      if (url) results.push({ ...url, start: match.index, token: match[0] });
    }
    return results;
  }
  const api = { decodeUrl, findLinks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.KarmoBase64 = api;
})();
