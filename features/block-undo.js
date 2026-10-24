(() => {
  const host = document.createElement('div');
  host.id = 'kl-block-undo';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host { --bg:#fff;--fg:#0f0f0f;--border:#ccc; color-scheme:light; }
    :host([dark]) { --bg:#212121;--fg:#f1f1f1;--border:#555; color-scheme:dark; }
    .stack { position:fixed;left:16px;bottom:16px;z-index:2300;display:grid;gap:8px;max-width:min(480px,calc(100vw - 32px));font:14px/1.4 Roboto,Arial,sans-serif;color:var(--fg); }
    .row { display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 18px #0003; }
    span { min-width:0;overflow-wrap:anywhere; }
    button { flex-shrink:0;min-height:44px;padding:8px;border:0;border-radius:4px;background:transparent;color:inherit;font:inherit;cursor:pointer; }
    button:hover { background:#8883; } button:disabled { opacity:.6;cursor:default; }
    :focus-visible { outline:2px solid #3ea6ff;outline-offset:2px; }
    @media(max-width:400px) { .row { flex-wrap:wrap; } .row span { flex-basis:100%; } }
  </style><div class="stack" aria-live="polite"></div>`;
  const stack = shadow.querySelector('.stack');
  const msg = (key, substitutions) => chrome.i18n.getMessage(key, substitutions);
  const theme = () => host.toggleAttribute('dark', document.documentElement.hasAttribute('dark') || document.documentElement.classList.contains('dark'));
  new MutationObserver(theme).observe(document.documentElement, { attributes:true, attributeFilter:['dark','class'] });
  theme();
  globalThis.KarmoBlockUndo = {
    show(key, record, beforeUndo, afterUndo) {
      if (!host.isConnected) document.documentElement.append(host);
      const row = document.createElement('div'), text = document.createElement('span');
      const undo = document.createElement('button'), dismiss = document.createElement('button');
      row.className = 'row'; text.textContent = msg('undoBlocked', record.name);
      undo.type = dismiss.type = 'button'; undo.textContent = msg('undoBlock'); dismiss.textContent = msg('undoDismiss');
      undo.setAttribute('aria-label', msg('undoBlock') + ': ' + record.name);
      dismiss.addEventListener('click', () => row.remove());
      undo.addEventListener('click', async () => {
        undo.disabled = true; let stale = false;
        try {
          await beforeUndo();
          const current = (await chrome.storage.local.get(key))[key];
          if (current?.created !== record.created) { stale = true; text.textContent = msg('undoChanged'); return; }
          await chrome.storage.local.remove(key);
          afterUndo();
          text.textContent = msg('undoRestored', record.name); undo.remove(); dismiss.focus();
        } catch { text.textContent = msg('undoFailed'); }
        finally { undo.disabled = stale; }
      });
      row.append(text, undo, dismiss); stack.append(row);
      while (stack.children.length > 3) stack.firstElementChild.remove();
    },
  };
})();
