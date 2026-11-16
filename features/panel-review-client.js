(() => {
  let snapshot = { rows:[], exceptions:[], readError:true }, tabId;
  const listeners = new Set();
  async function call(action, key) {
    if (!tabId) throw new Error('YouTube tab unavailable');
    const result = await chrome.tabs.sendMessage(tabId, { type:'karmolab.review', action, key });
    if (!result?.ok) throw new Error('Review unavailable');
    return result.value;
  }
  async function refresh() {
    try {
      if (!tabId) { const [tab] = await chrome.tabs.query({ active:true, currentWindow:true }); if (tab?.url?.startsWith('https://www.youtube.com/')) tabId = tab.id; }
      snapshot = await call('snapshot');
    } catch { snapshot = { rows:[], exceptions:[], readError:true }; }
    listeners.forEach(fn => fn());
  }
  globalThis.KarmoFilterReview = { snapshot:() => structuredClone(snapshot), subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  for (const action of ['show','allow','retry','revoke']) globalThis.KarmoFilterReview[action] = async key => { await call(action,key); await refresh(); };
  globalThis.KarmoFilterReview.ready = refresh();
  setInterval(() => { if (!document.hidden) void refresh(); }, 2000);
})();
