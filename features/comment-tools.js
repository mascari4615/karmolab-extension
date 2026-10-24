(() => {
  const comments = 'ytd-comment-view-model,ytd-comment-renderer';
  const msg = key => chrome.i18n.getMessage(key);
  const host = document.createElement('div'); host.id = 'kl-comment-profile';
  const shadow = host.attachShadow({ mode:'open' });
  shadow.innerHTML = `<style>
    :host{font:14px/1.5 Roboto,Arial,sans-serif;color:var(--profile-text,#0f0f0f)}
    [hidden]{display:none!important} *{box-sizing:border-box}
    section{position:fixed;z-index:2300;width:260px;max-width:calc(100vw - 16px);padding:12px;background:var(--profile-bg,#fff);border:1px solid var(--profile-line,#ccc);border-radius:8px;box-shadow:0 6px 20px #0003}
    header{display:flex;align-items:center;gap:8px} strong{flex:1;overflow-wrap:anywhere;font-weight:500}
    button,a{display:flex;align-items:center;min-height:44px;color:inherit;font:inherit;padding:8px 10px;border:0;border-radius:4px;background:transparent;text-align:start;cursor:pointer;text-decoration:none}
    button:hover,a:hover{background:var(--profile-hover,#eee)} button:disabled{opacity:.6;cursor:default}
    #close{width:44px;justify-content:center;padding:10px} svg{width:20px;height:20px}
    #block{width:100%} :focus-visible{outline:2px solid var(--profile-focus,#065fd4);outline-offset:2px}
  </style><section role="dialog" aria-modal="false" aria-labelledby="handle" hidden>
    <header><strong id="handle"></strong><button id="close" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></header>
    <a id="channel"></a><button id="block" type="button"></button>
  </section>`;
  const $ = s => shadow.querySelector(s), panel = $('section');
  $('#close').setAttribute('aria-label',msg('panelClose'));
  $('#channel').textContent = msg('profileOpenChannel'); $('#block').textContent = msg('blockUser');
  let trigger, root, identityHref;
  function close(focus = true) {
    panel.hidden = true; trigger?.setAttribute('aria-expanded','false');
    if (focus && trigger?.isConnected) trigger.focus({ preventScroll:true });
    trigger = root = undefined;
  }
  function place() {
    if (panel.hidden) return;
    if (!trigger?.isConnected) { close(false); return; }
    const anchor = trigger.getBoundingClientRect(), rect = panel.getBoundingClientRect();
    if (anchor.bottom < 56 || anchor.top > innerHeight) { close(false); return; }
    panel.style.left = Math.max(8,Math.min(anchor.left,innerWidth-rect.width-8))+'px';
    panel.style.top = Math.max(64,Math.min(anchor.bottom+6,innerHeight-rect.height-8))+'px';
  }
  function open(control, comment) {
    if (!panel.hidden && trigger === control) { close(); return; }
    close(false);
    const author = comment.querySelector('#author-text');
    let url;
    try { url = new URL(author?.getAttribute('href'),location.origin); } catch { return; }
    if (url.origin !== location.origin || !/^\/(?:@[^/]+|channel\/UC[\w-]{22})\/?$/.test(url.pathname)) return;
    root = comment; trigger = control; identityHref = author.href;
    $('#handle').textContent = control.getAttribute('aria-label') || author.textContent.trim();
    $('#channel').href = url.href;
    $('#block').disabled = !comment.querySelector('.kl-block-button--comment:not(:disabled)');
    const dark = document.documentElement.hasAttribute('dark');
    for (const [key,value] of Object.entries(dark ? {bg:'#212121',text:'#f1f1f1',line:'#555',hover:'#383838',focus:'#3ea6ff'} : {bg:'#fff',text:'#0f0f0f',line:'#ccc',hover:'#eee',focus:'#065fd4'})) host.style.setProperty('--profile-'+key,value);
    host.style.colorScheme = dark ? 'dark' : 'light';
    if (!host.isConnected) document.documentElement.append(host);
    panel.hidden = false;
    place();
    control.setAttribute('aria-expanded','true'); $('#channel').focus({ preventScroll:true });
  }
  document.addEventListener('click',event => {
    if (document.documentElement.dataset.klCommentDensity !== 'compact') return;
    const control = event.target.closest?.('#author-thumbnail-button,ytd-comment-renderer #author-thumbnail');
    const comment = control?.closest(comments);
    if (comment) { event.preventDefault(); event.stopImmediatePropagation(); open(control,comment); return; }
    const less = event.target.closest?.('ytd-expander > #less');
    const owner = less?.closest(comments);
    if (owner) requestAnimationFrame(() => {
      if (!owner.isConnected) return;
      if (owner.getBoundingClientRect().top < 64) owner.scrollIntoView({ block:'start',behavior:'instant' });
      owner.querySelector('ytd-expander > #more:not([hidden])')?.focus({ preventScroll:true });
    });
  },true);
  $('#close').addEventListener('click',()=>close());
  $('#channel').addEventListener('click',()=>close(false));
  $('#block').addEventListener('click',()=> {
    if (!root?.isConnected || root.querySelector('#author-text')?.href !== identityHref) { close(); return; }
    const comment = root; close(); globalThis.KarmoUserBlock?.request(comment);
  });
  shadow.addEventListener('keydown',event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  });
  shadow.addEventListener('keyup',event=>event.stopPropagation());
  document.addEventListener('pointerdown',event=> {
    if (!panel.hidden && !event.composedPath().includes(host) && !event.composedPath().includes(trigger)) close(false);
  });
  document.addEventListener('yt-navigate-start',()=>close(false));
  window.addEventListener('resize',()=>close(false));
  let scrollFrame;
  window.addEventListener('scroll',()=> {
    if (!panel.hidden && !scrollFrame) scrollFrame = requestAnimationFrame(()=>{ scrollFrame=undefined; place(); });
  },true);
  chrome.storage.onChanged.addListener((changes,area)=> {
    if (area === 'local' && changes.commentDensity) close(false);
  });
})();
