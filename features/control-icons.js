(() => {
  const paths = {
    add: '<path d="M12 4v16M4 12h16"/>',
    blocked: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    undo: '<path d="M9 4 3 10l6 6M3 10h10a7 7 0 0 1 7 7"/>',
    show: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    allow: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
    save: '<path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    retry: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
  };
  function apply(button, name, label) {
    button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.show}</svg>`;
    button.title = label; button.setAttribute('aria-label', label);
  }
  function toast(element, dismiss, duration = 6000) {
    let timeout, start, remaining = duration, busy = false;
    const paused = () => busy || element.matches(':hover') || element.matches(':focus-within');
    const pause = () => { if (timeout) remaining = Math.max(0, remaining - (performance.now() - start)); clearTimeout(timeout); timeout = undefined; };
    const resume = () => { if (timeout || paused()) return; start = performance.now(); timeout = setTimeout(() => { timeout = undefined; dismiss(); }, remaining); };
    element.addEventListener('pointerenter', pause); element.addEventListener('pointerleave', resume);
    element.addEventListener('focusin', pause); element.addEventListener('focusout', () => queueMicrotask(resume));
    resume();
    return { pause: () => { busy = true; pause(); }, restart: () => { pause(); busy = false; remaining = duration; resume(); }, cancel: pause };
  }
  globalThis.KarmoControlIcons = { apply, toast };
})();
