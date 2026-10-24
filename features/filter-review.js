(() => {
  const prefix = 'filterAllow:';
  const scopes = new Map(), listeners = new Set(), changeListeners = new Set(), once = new Set(), allowed = new Map();
  const localComments = new WeakMap();
  let serial = 0, generation = 0, storageVersion = 0, readError = false;
  const versions = new Map();
  const publish = () => listeners.forEach(listener => listener());
  const notify = () => { publish(); changeListeners.forEach(listener => listener()); };
  function rows() {
    const merged = new Map();
    for (const entries of scopes.values()) for (const entry of entries) {
      if (!entry.root.isConnected || once.has(entry.key) || allowed.has(entry.key)) continue;
      const previous = merged.get(entry.key);
      if (previous) { if (!previous.reasons.includes(entry.reason)) previous.reasons.push(entry.reason); }
      else merged.set(entry.key, { ...entry, reasons: [entry.reason] });
    }
    return [...merged.values()];
  }
  function comment(root) {
    for (const link of root.querySelectorAll('a[href*="lc="]')) {
      try { const id = new URL(link.href).searchParams.get('lc'); if (id && /^[\w.-]{1,200}$/.test(id)) return { key: 'comment:' + id, stable: true }; } catch { /* 불완전 링크 제외 */ }
    }
    const signature = (root.querySelector('#author-text')?.getAttribute('href') || '') + '\n' + (root.querySelector('#content-text')?.textContent || '');
    let entry = localComments.get(root);
    if (!entry || entry.signature !== signature) { entry = { signature, key: 'comment:local:' + (++serial) }; localComments.set(root, entry); }
    return { key: entry.key, stable: false };
  }
  async function load() {
    const version = storageVersion;
    try {
      const values = await chrome.storage.local.get(null);
      if (version !== storageVersion) return load();
      allowed.clear();
      for (const [key, value] of Object.entries(values)) if (key.startsWith(prefix) && value) allowed.set(key.slice(prefix.length), value);
    } catch { readError = true; /* 예외 설정 읽기 실패 시 원래 차단 유지 */ }
  }
  const ready = load();
  const api = {
    ready, comment,
    bypass: key => once.has(key) || allowed.has(key),
    set: (scope, entries) => { scopes.set(scope, entries); publish(); },
    snapshot: () => ({ rows: rows().map(({ root, retry, ...entry }) => ({ ...entry, canRetry: Boolean(retry) })), exceptions: [...allowed].map(([key, value]) => ({ key, ...value })), readError }),
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    onChange: listener => { changeListeners.add(listener); return () => changeListeners.delete(listener); },
    show: key => { if (rows().some(entry => entry.key === key)) { once.add(key); notify(); } },
    retry: key => { const entry = rows().find(entry => entry.key === key); entry?.retry?.(); },
    allow: async key => {
      const entry = rows().find(entry => entry.key === key);
      if (!entry?.stable) return;
      const record = { kind: entry.kind, created: Date.now() };
      const version = versions.get(key) || 0;
      await chrome.storage.local.set({ [prefix + key]: record });
      if ((versions.get(key) || 0) === version) allowed.set(key, record);
      notify();
    },
    revoke: async key => {
      const version = versions.get(key) || 0;
      await chrome.storage.local.remove(prefix + key);
      if ((versions.get(key) || 0) === version) allowed.delete(key);
      once.delete(key); notify();
    },
    get generation() { return generation; },
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let changed = false;
    for (const [key, change] of Object.entries(changes)) if (key.startsWith(prefix)) {
      changed = true;
      storageVersion++;
      versions.set(key.slice(prefix.length), (versions.get(key.slice(prefix.length)) || 0) + 1);
      if (change.newValue) allowed.set(key.slice(prefix.length), change.newValue); else allowed.delete(key.slice(prefix.length));
    }
    if (changed) notify();
  });
  document.addEventListener('yt-navigate-start', () => { scopes.clear(); once.clear(); generation++; notify(); });
  globalThis.KarmoFilterReview = api;
})();
