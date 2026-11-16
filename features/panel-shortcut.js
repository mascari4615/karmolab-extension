(() => {
  const button = document.createElement('button'); button.id = 'kl-panel-trigger'; button.type = 'button'; button.textContent = 'KarmoLab';
  button.title = chrome.i18n.getMessage('panelOpen'); button.setAttribute('aria-label', button.title);
  button.addEventListener('click', async () => {
    try { const result = await chrome.runtime.sendMessage({ type:'karmolab.panel.open' }); if (!result?.ok) throw new Error(); }
    catch { button.textContent = navigator.language.startsWith('ko') ? '오른쪽 위 확장 아이콘에서 KarmoLab 열기' : 'Open KarmoLab from the browser toolbar'; }
  });
  const mount = () => { const parent = document.querySelector('ytd-masthead #buttons'); if (parent && button.parentElement !== parent) parent.prepend(button); };
  let frame;
  new MutationObserver(() => { if (frame || button.isConnected) return; frame = requestAnimationFrame(() => { frame = null; mount(); }); }).observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener('yt-navigate-finish', mount); mount();
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'karmolab.review') return false;
    const api = globalThis.KarmoFilterReview;
    if (!api) { respond({ ok:false }); return false; }
    const allowed = ['snapshot', 'show', 'allow', 'retry', 'revoke'];
    if (!allowed.includes(message.action)) return false;
    Promise.resolve().then(() => api[message.action](message.key)).then(value => respond({ ok:true, value }), () => respond({ ok:false }));
    return true;
  });
})();
