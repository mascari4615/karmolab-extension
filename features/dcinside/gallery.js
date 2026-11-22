(() => {
  const idPattern = /^[a-z0-9_-]{1,80}$/i;
  function fromUrl(value, base) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, base);
      if (url.protocol !== 'https:') return '';
      let id;
      if (url.hostname === 'gall.dcinside.com' && /^\/(?:(?:m?gallery|mini|person)\/)?board\/(?:lists|view)\/?$/.test(url.pathname)) {
        id = url.searchParams.get('id');
      }
      if (url.hostname === 'm.dcinside.com') id = /^\/board\/([^/]+)(?:\/\d+)?\/?$/.exec(url.pathname)?.[1];
      return id && idPattern.test(id) ? id.toLowerCase() : '';
    } catch { return ''; }
  }
  const parse = value => {
    const input = String(value || '').trim();
    return idPattern.test(input) ? input.toLowerCase() : fromUrl(input);
  };
  globalThis.KarmoDcGallery = { fromUrl, parse };
})();
