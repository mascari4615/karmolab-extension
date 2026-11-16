/* Move existing controls intact so tab changes preserve drafts and listeners. */
globalThis.KarmoSettingsNavigation = (host, groups, key) => {
  const english = !navigator.language.startsWith('ko');
  const layout = document.createElement('div'); layout.className = 'kl-settings-layout';
  const nav = document.createElement('div'); nav.className = 'kl-settings-nav';
  nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', english ? 'Settings categories' : '설정 분류'); nav.setAttribute('aria-orientation', 'vertical');
  const body = document.createElement('main'); body.className = 'kl-settings-content';
  const tabs = [];
  for (const group of groups) {
    const tab = document.createElement('button'); tab.type = 'button'; tab.id = `${key}-tab-${group.id}`;
    tab.textContent = english ? group.en : group.title; tab.setAttribute('role', 'tab');
    const pane = document.createElement('div'); pane.id = `${key}-pane-${group.id}`; pane.className = 'kl-settings-pane';
    pane.setAttribute('role', 'tabpanel'); pane.setAttribute('aria-labelledby', tab.id);
    tab.setAttribute('aria-controls', pane.id);
    const heading = document.createElement('h1'); heading.textContent = tab.textContent; pane.append(heading);
    if (group.hint) { const hint = document.createElement('p'); hint.className = 'kl-settings-hint'; hint.textContent = english ? group.hintEn : group.hint; pane.append(hint); }
    for (const node of group.nodes.filter(Boolean)) pane.append(node);
    nav.append(tab); body.append(pane); tabs.push({ tab, pane, id: group.id });
  }
  let selected;
  function select(id, focus = false) {
    selected = tabs.find(item => item.id === id) || tabs[0];
    for (const item of tabs) {
      const active = item === selected; item.tab.setAttribute('aria-selected', String(active)); item.tab.tabIndex = active ? 0 : -1; item.pane.hidden = !active;
    }
    if (focus) selected.tab.focus();
    body.scrollTop = 0;
    try { sessionStorage.setItem(key, selected.id); } catch { /* unavailable in some embedded contexts */ }
  }
  for (const item of tabs) item.tab.addEventListener('click', () => select(item.id));
  nav.addEventListener('keydown', event => {
    const index = tabs.indexOf(selected);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : ['ArrowDown', 'ArrowRight'].includes(event.key) ? (index + 1) % tabs.length : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? (index + tabs.length - 1) % tabs.length : -1;
    if (next < 0) return; event.preventDefault(); select(tabs[next].id, true);
  });
  layout.append(nav, body); host.append(layout);
  let initial; try { initial = sessionStorage.getItem(key); } catch { /* use first category */ }
  select(initial);
  return { select, layout };
};
