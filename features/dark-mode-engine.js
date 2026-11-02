(() => {
  if (globalThis.KarmoDarkEngine) return;
  const attribute = 'data-kl-dark-paint';
  const excluded = 'head,script,style,link,meta,noscript,img,picture,video,audio,canvas,iframe,svg,[data-kl-dark-ignore]';
  function rgb(value) {
    const match = /^rgba?\(([^)]+)\)$/.exec(value);
    if (!match) return null;
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(value => !Number.isFinite(value))) return null;
    return [...parts.slice(0, 3), parts[3] ?? 1];
  }
  function hsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, light = (max + min) / 2;
    let hue = 0;
    if (delta) {
      if (max === r) hue = ((g - b) / delta + 6) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
    }
    return [hue * 60, delta ? delta / (1 - Math.abs(2 * light - 1)) : 0, light];
  }
  function luminance(color) {
    const linear = color.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; });
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  }
  function mapColor(value, role) {
    const color = rgb(value);
    if (!color || color[3] < .02) return null;
    const [hue, saturation, light] = hsl(color), y = luminance(color);
    let target, sat;
    if (role === 'background') {
      if (y < .16 && light < .5) return null;
      target = .105 + (1 - light) * .17;
      sat = Math.min(saturation * .6, .35);
    } else if (role === 'border') {
      target = .26; sat = Math.min(saturation * .4, .3);
    } else {
      if (y >= .6) return null;
      target = saturation > .2 ? .74 : .88 - light * .12;
      sat = Math.min(saturation, .8);
    }
    return `hsla(${Math.round(hue)},${(sat * 100).toFixed(1)}%,${(target * 100).toFixed(1)}%,${color[3]})`;
  }
  let enabled = false, nativeTheme = false, observer, sheet, frame = 0, resizeTimer;
  let previousRoot, lastDuration = 0, lastCount = 0;
  const touched = new Map(), rules = new Map(), pending = new Set();
  const base = 'html[data-kl-dark]{color-scheme:dark!important;background:#191b20!important;color:#e0e0e0!important}html[data-kl-dark] ::selection{background:#42628c!important;color:#fff!important}';
  function nativeDark() {
    const ownSheet = sheet?.sheet;
    if (ownSheet) ownSheet.disabled = true;
    try {
      const body = getComputedStyle(document.body || document.documentElement), root = getComputedStyle(document.documentElement);
      const background = [rgb(body.backgroundColor), rgb(root.backgroundColor)].find(value => value && value[3] > .9);
      const text = rgb(body.color);
      return Boolean(background && text && luminance(background) < .12 && luminance(text) > .45);
    } finally { if (ownSheet) ownSheet.disabled = false; }
  }
  function restoreRoot() {
    if (!['native', 'site'].includes(document.documentElement.getAttribute('data-kl-dark'))) return;
    if (previousRoot === null) document.documentElement.removeAttribute('data-kl-dark'); else document.documentElement.setAttribute('data-kl-dark', previousRoot);
  }
  function restore(element, record) {
    if (element.getAttribute(attribute) !== record.assigned) return;
    if (record.previous === null) element.removeAttribute(attribute);
    else element.setAttribute(attribute, record.previous);
  }
  function paint(style) {
    const declarations = [];
    for (const [property, role] of [['color', 'text'], ['background-color', 'background'], ['border-top-color', 'border'], ['border-right-color', 'border'], ['border-bottom-color', 'border'], ['border-left-color', 'border'], ['outline-color', 'border']]) {
      // Invisible borders need no override; retain native geometry.
      if (property.startsWith('border-') && style.getPropertyValue(property.replace('-color', '-style')) === 'none') continue;
      if (property === 'outline-color' && style.outlineStyle === 'none') continue;
      const color = mapColor(style.getPropertyValue(property), role);
      if (color) declarations.push(`${property}:${color}!important`);
    }
    const image = style.backgroundImage;
    if (image.includes('gradient(') && !image.includes('url(')) {
      const mapped = image.replace(/rgba?\([^)]+\)/g, value => mapColor(value, 'background') || value);
      if (mapped !== image) declarations.push(`background-image:${mapped}!important`);
    }
    return declarations.join(';');
  }
  function collect(root) {
    if (root.nodeType !== 1) return [];
    return [root, ...root.querySelectorAll('*')].filter(element => element.namespaceURI === 'http://www.w3.org/1999/xhtml' && !element.closest(excluded));
  }
  function flush() {
    frame = 0;
    if (!enabled) return;
    const start = performance.now();
    for (const [element, record] of touched) if (!element.isConnected) { restore(element, record); touched.delete(element); }
    const roots = [...pending].filter(root => root.isConnected);
    pending.clear();
    const elements = [...new Set(roots.filter(root => !roots.some(parent => parent !== root && parent.contains(root))).flatMap(collect))];
    // Separate restore, computed-style reads, and writes to avoid layout thrashing.
    for (const element of elements) {
      const record = touched.get(element);
      if (record) { restore(element, record); touched.delete(element); }
    }
    const plans = elements.map(element => {
      const style = getComputedStyle(element);
      let before = '', after = '';
      for (const pseudo of ['::before', '::after']) {
        const pseudoStyle = getComputedStyle(element, pseudo);
        if (!['none', 'normal', ''].includes(pseudoStyle.content)) {
          if (pseudo === '::before') before = paint(pseudoStyle); else after = paint(pseudoStyle);
        }
      }
      return { element, declaration: paint(style), before, after };
    });
    let added = false;
    for (const plan of plans) {
      if (!plan.declaration && !plan.before && !plan.after) continue;
      const key = JSON.stringify([plan.declaration, plan.before, plan.after]);
      if (!rules.has(key)) {
        const id = String(rules.size + 1), selector = `[${attribute}="${id}"]`;
        rules.set(key, { id, css: `${selector}{${plan.declaration}}${plan.before ? selector + '::before{' + plan.before + '}' : ''}${plan.after ? selector + '::after{' + plan.after + '}' : ''}` });
        added = true;
      }
      const assigned = rules.get(key).id;
      touched.set(plan.element, { previous: plan.element.getAttribute(attribute), assigned });
      plan.element.setAttribute(attribute, assigned);
    }
    if (added || !sheet.isConnected) {
      sheet.textContent = base + [...rules.values()].map(rule => rule.css).join('') + (location.hostname === 'gall.dcinside.com' ? 'html[data-kl-dark] .dc_logo img{filter:brightness(0) invert(1)!important}' : '');
      if (!sheet.isConnected) document.documentElement.append(sheet);
    }
    lastDuration = performance.now() - start; lastCount = elements.length;
  }
  function schedule(root = document.body) {
    if (!enabled || !root) return;
    pending.add(root);
    if (!frame) frame = requestAnimationFrame(flush);
  }
  function onLoad(event) {
    if (event.target.tagName === 'LINK' && event.target.rel === 'stylesheet') schedule(document.body);
  }
  function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => schedule(document.body), 120); }
  function onInteraction(event) {
    const target = event.target;
    if (target.nodeType === 1) schedule(target.closest('tr,li') || target.closest('a,button,input,select,textarea,label,[role="button"]') || target);
  }
  function enable() {
    if (enabled || nativeTheme) return;
    previousRoot = document.documentElement.getAttribute('data-kl-dark');
    if (nativeDark()) {
      nativeTheme = true;
      document.documentElement.setAttribute('data-kl-dark', 'site');
      observer = new MutationObserver(() => { if (!nativeDark()) { disable(); enable(); } });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
      if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
      return;
    }
    enabled = true;
    document.documentElement.setAttribute('data-kl-dark', 'native');
    sheet = document.createElement('style'); sheet.dataset.klDarkStyle = 'true'; sheet.textContent = base;
    document.documentElement.append(sheet);
    observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.target === sheet || record.target.parentElement === sheet) continue;
        if (record.type === 'attributes') {
          if ((record.target === document.documentElement || record.target === document.body) && nativeDark()) { disable(); enable(); return; }
          schedule(record.target);
        }
        else {
          for (const node of record.addedNodes) if (node !== sheet && node.nodeType === 1) schedule(node);
          if (record.removedNodes.length && record.target !== sheet) schedule(record.target);
        }
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
    document.addEventListener('load', onLoad, true); window.addEventListener('resize', onResize);
    for (const type of ['pointerover', 'pointerout', 'focusin', 'focusout']) document.addEventListener(type, onInteraction, true);
    schedule(document.body);
  }
  function disable() {
    if (nativeTheme) { nativeTheme = false; observer.disconnect(); restoreRoot(); return; }
    if (!enabled) return;
    enabled = false; observer.disconnect(); cancelAnimationFrame(frame); frame = 0;
    clearTimeout(resizeTimer); document.removeEventListener('load', onLoad, true); window.removeEventListener('resize', onResize);
    for (const type of ['pointerover', 'pointerout', 'focusin', 'focusout']) document.removeEventListener(type, onInteraction, true);
    for (const [element, record] of touched) restore(element, record);
    touched.clear(); pending.clear(); rules.clear(); sheet.remove();
    restoreRoot(); sheet = undefined;
  }
  globalThis.KarmoDarkEngine = { enable, disable, mapColor, luminance, stats: () => ({ enabled, nativeTheme, elements: touched.size, rules: rules.size, lastDuration, lastCount, pending: pending.size }) };
})();
