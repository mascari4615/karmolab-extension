(() => {
  if (document.getElementById('kl-youtube-panel')) return;
  const msg = key => chrome.i18n.getMessage(key);
  const host = document.createElement('div');
  host.id = 'kl-youtube-panel';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { color-scheme: light dark; font: 14px/1.5 Roboto, Arial, sans-serif; color: var(--yt-spec-text-primary, #0f0f0f); }
      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      aside { position: fixed; z-index: 2200; top: 64px; right: 16px; bottom: 16px; width: 360px; max-width: calc(100% - 24px); background: var(--yt-spec-base-background, #fff); border: 1px solid var(--yt-spec-10-percent-layer, #ccc); border-radius: 12px; box-shadow: 0 8px 28px #0003; display: flex; flex-direction: column; overflow: hidden; }
      header { display: flex; flex-shrink: 0; align-items: center; padding: 12px 12px 12px 20px; gap: 8px; border-bottom: 1px solid var(--yt-spec-10-percent-layer, #ccc); }
      h2 { flex: 1; font-size: 18px; line-height: 28px; margin: 0; font-weight: 600; }
      h3 { font-size: 14px; margin: 0 0 12px; font-weight: 600; }
      main { overflow: auto; min-height: 0; overscroll-behavior: contain; padding: 0 20px; scrollbar-color: var(--yt-spec-text-secondary, #606060) transparent; }
      section { padding: 20px 0; border-bottom: 1px solid var(--yt-spec-10-percent-layer, #ccc); }
      section:last-child { border: 0; }
      label { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; cursor: pointer; }
      input, textarea, button, select { font: inherit; color: inherit; }
      select { width:100%;min-height:44px;font-size:16px;padding:8px;background:var(--yt-spec-base-background,#fff);border:1px solid var(--yt-spec-text-secondary,#606060);border-radius:6px; }
      input[type=file] { max-width:100%;font-size:16px; }
      input[type=range] { display:block;width:100%;min-height:44px;margin:0;accent-color:var(--yt-spec-call-to-action,#065fd4); }
      output { font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--yt-spec-text-secondary,#606060); }
      .actions { display:flex;gap:8px;flex-wrap:wrap;margin-top:12px; }
      #blocked { max-height:240px;overflow:auto; }
      input[type=checkbox] { width: 18px; height: 18px; margin: 0; flex-shrink: 0; accent-color: var(--yt-spec-call-to-action, #065fd4); }
      input[type=search], textarea { display: block; width: 100%; border: 1px solid var(--yt-spec-text-secondary, #606060); border-radius: 6px; padding: 10px 12px; background: transparent; font-size: 16px; caret-color: var(--yt-spec-call-to-action, #065fd4); }
      textarea { min-height: 108px; resize: vertical; }
      input::placeholder, textarea::placeholder { color: var(--yt-spec-text-secondary, #606060); opacity: 1; }
      p { margin: 6px 0 12px; color: var(--yt-spec-text-secondary, #606060); font-size: 12px; }
      button { min-height: 44px; border: 0; border-radius: 6px; background: var(--yt-spec-badge-chip-background, #eee); padding: 8px 14px; cursor: pointer; }
      button:hover { background: var(--yt-spec-10-percent-layer, #ddd); }
      button:disabled, input:disabled, textarea:disabled { opacity: .6; cursor: default; }
      :focus-visible { outline: 2px solid var(--yt-spec-call-to-action, #065fd4); outline-offset: 2px; }
      ::selection { background: var(--yt-spec-call-to-action, #065fd4); color: #fff; }
      #close { width: 44px; padding: 10px; background: transparent; }
      #close svg { width: 24px; height: 24px; display: block; }
      #save { margin-top: 12px; }
      ul { list-style: none; margin: 12px 0 0; padding: 0; }
      li { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
      li span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
      .review-row { display: block; padding: 12px 0; border-bottom: 1px solid var(--yt-spec-10-percent-layer, #ccc); }
      .review-row p { margin: 4px 0 8px; }
      .review-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      footer { flex-shrink: 0; padding: 8px 20px 12px; border-top: 1px solid var(--yt-spec-10-percent-layer, #ccc); }
      #status { margin: 0; min-height: 18px; overflow-wrap: anywhere; }
      #retry { margin-top: 6px; }
      @media (max-width: 600px) { aside { top: 60px; right: 8px; bottom: 8px; max-width: calc(100% - 16px); } }
    </style>
    <aside role="dialog" aria-modal="false" aria-labelledby="title" hidden>
      <header><h2 id="title">KarmoLab</h2><button id="close" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></header>
      <main>
        <section><h3 data-msg="densityHeading"></h3>
          <label for="commentDensity" data-msg="commentDensityLabel"></label>
          <select id="commentDensity" disabled><option value="default" data-msg="densityDefault"></option><option value="compact" data-msg="commentDensityCompact"></option></select>
          <p data-msg="commentDensityHint"></p>
          <label for="commentFontSize"><span data-msg="commentFontSizeLabel"></span><output for="commentFontSize" id="commentFontSizeValue"></output></label>
          <input id="commentFontSize" type="range" min="12" max="20" step="1" disabled>
          <label for="commentLineHeight"><span data-msg="commentLineHeightLabel"></span><output for="commentLineHeight" id="commentLineHeightValue"></output></label>
          <input id="commentLineHeight" type="range" min="18" max="32" step="2" disabled>
          <kl-home-size></kl-home-size><p data-msg="homeColumnsHint"></p>
        </section>
        <section><h3 data-msg="panelComments"></h3>
          <label><span data-msg="commentTranslate"></span><input id="translation" type="checkbox" disabled></label>
          <p data-msg="panelTranslationHint"></p>
        </section>
        <section><h3 data-msg="keywordHeading"></h3>
          <label><span data-msg="keywordEnabled"></span><input id="keywords" type="checkbox" disabled></label>
          <label><span data-msg="keywordComments"></span><input id="scope-comments" type="checkbox" disabled></label>
          <label><span data-msg="keywordVideos"></span><input id="scope-videos" type="checkbox" disabled></label>
          <label><span data-msg="keywordShorts"></span><input id="scope-shorts" type="checkbox" disabled></label>
          <label for="words" data-msg="panelKeywords"></label>
          <textarea id="words" rows="3" maxlength="40200" disabled></textarea>
          <p data-msg="keywordWordsLabel"></p><button id="save" type="button" disabled data-msg="keywordSave"></button>
        </section>
        <section><h3 data-msg="shortsCountHeadingPanel"></h3>
          <label><span data-msg="featShortsDate"></span><input id="shortsDate" type="checkbox" disabled></label>
          <label><span data-msg="featShortsCount"></span><input id="shortsCount" type="checkbox" disabled></label>
          <label for="countMode" data-msg="shortsCountDisplay"></label>
          <select id="countMode" disabled><option value="both" data-msg="shortsCountModeBoth"></option><option value="unique" data-msg="shortsCountModeUnique"></option><option value="views" data-msg="shortsCountModeViews"></option></select>
          <label><span data-msg="shortsWatchTimeDisplay"></span><input id="watchTime" type="checkbox" disabled></label>
        </section>
        <section><h3 data-msg="blockedUsers"></h3>
          <label><span data-msg="featUserBlock"></span><input id="blocking" type="checkbox" disabled></label>
          <input id="search" type="search" autocomplete="off" disabled>
          <p id="empty"></p><ul id="blocked"></ul>
        </section>
        <section><h3 data-msg="reviewHeading"></h3>
          <p id="review-count" role="status" aria-live="polite"></p><ul id="review-list"></ul>
          <h3 data-msg="reviewExceptions"></h3><ul id="review-exceptions"></ul>
        </section>
        <section><h3 data-msg="backupHeading"></h3><p data-msg="backupHint"></p>
          <button id="export" type="button" disabled data-msg="backupExport"></button>
          <label for="importFile" data-msg="backupChoose"></label><input id="importFile" type="file" accept=".json,application/json" disabled>
          <p id="preview" role="status"></p><button id="restore" type="button" disabled data-msg="backupRestore"></button>
        </section>
      </main>
      <footer><p id="status" role="status" aria-live="polite"></p><button id="retry" type="button" hidden data-msg="panelRetry"></button></footer>
    </aside>`;
  const $ = selector => shadow.querySelector(selector);
  for (const node of shadow.querySelectorAll('[data-msg]')) node.textContent = msg(node.dataset.msg);
  $('#close').setAttribute('aria-label', msg('panelClose'));
  $('#search').setAttribute('aria-label', msg('panelSearch'));
  $('#search').placeholder = msg('panelSearch');
  const panel = $('aside'), words = $('#words'), status = $('#status');
  const trigger = document.createElement('button');
  trigger.id = 'kl-panel-trigger'; trigger.type = 'button';
  trigger.textContent = 'KarmoLab'; trigger.title = msg('panelOpen');
  trigger.setAttribute('aria-label', msg('panelOpen'));
  trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-haspopup', 'dialog');
  function syncTheme() {
    const dark = document.documentElement.hasAttribute('dark') || document.documentElement.classList.contains('dark');
    const colors = dark ? ['#0f0f0f', '#f1f1f1', '#aaa', '#333', '#272727', '#3ea6ff'] : ['#fff', '#0f0f0f', '#606060', '#ddd', '#eee', '#065fd4'];
    const names = ['base-background', 'text-primary', 'text-secondary', '10-percent-layer', 'badge-chip-background', 'call-to-action'];
    for (let i = 0; i < names.length; i++) {
      host.style.setProperty('--yt-spec-' + names[i], colors[i]);
      trigger.style.setProperty('--yt-spec-' + names[i], colors[i]);
    }
    host.style.colorScheme = dark ? 'dark' : 'light';
  }
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['dark', 'class'] });
  syncTheme();
  let values = {}, loaded = false, loading = false, dirty = false, draftVersion = 0, changeVersion = 0;
  let savingWords = false, mountTimer;
  let syncValues = {}, backupBusy = false, selectedBackup = null, fileVersion = 0;
  const pending = new Set();
  const toggles = { commentTranslate: $('#translation'), keywordEnabled: $('#keywords'), keywordComments: $('#scope-comments'), keywordVideos: $('#scope-videos'), keywordShorts: $('#scope-shorts'), userBlock: $('#blocking'), shortsDate: $('#shortsDate'), shortsCount: $('#shortsCount'), shortsWatchTime: $('#watchTime') };
  const review = globalThis.KarmoFilterReview, reviewPending = new Set();
  let reviewSignature = '';
  function renderReview() {
    if (!review) { $('#review-count').textContent = msg('reviewUnavailable'); return; }
    const snapshot = review.snapshot();
    const signature = JSON.stringify([snapshot, [...reviewPending]]);
    if (signature === reviewSignature) return;
    reviewSignature = signature;
    $('#review-count').textContent = snapshot.readError ? msg('reviewUnavailable') : chrome.i18n.getMessage('reviewCount', String(snapshot.rows.length));
    const kind = value => msg({ video: 'reviewVideo', shorts: 'reviewShorts', comment: 'reviewComment', channel: 'reviewChannel' }[value] || 'reviewVideo');
    const action = (row, key, label, callback) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = msg(label); button.disabled = reviewPending.has(key);
      button.addEventListener('click', async () => {
        reviewPending.add(key); renderReview();
        try { await callback(); announce('panelSaved'); }
        catch { announce('panelSaveError'); }
        finally { reviewPending.delete(key); renderReview(); if (!panel.hidden) { $('#review-count').tabIndex = -1; $('#review-count').focus({ preventScroll: true }); } }
      });
      row.append(button);
    };
    $('#review-list').replaceChildren();
    snapshot.rows.forEach((entry, index) => {
      const row = document.createElement('li'), title = document.createElement('strong'), reason = document.createElement('p'), actions = document.createElement('div');
      row.className = 'review-row'; row.dataset.reviewKey = entry.key; actions.className = 'review-actions';
      title.textContent = kind(entry.kind) + ' ' + (index + 1); reason.textContent = entry.reasons.join(', ');
      action(actions, entry.key, 'reviewShowOnce', () => review.show(entry.key));
      if (entry.stable) action(actions, entry.key, 'reviewAllow', () => review.allow(entry.key));
      if (entry.canRetry) action(actions, entry.key, 'reviewRetry', () => review.retry(entry.key));
      row.append(title, reason, actions); $('#review-list').append(row);
    });
    $('#review-exceptions').replaceChildren();
    snapshot.exceptions.sort((a, b) => b.created - a.created).forEach((entry, index) => {
      const row = document.createElement('li'), label = document.createElement('span');
      row.dataset.allowKey = entry.key;
      label.textContent = kind(entry.kind) + ' ' + (index + 1); row.append(label);
      action(row, entry.key, 'reviewRevoke', () => review.revoke(entry.key)); $('#review-exceptions').append(row);
    });
  }
  review?.subscribe(renderReview);
  review?.ready.then(renderReview);
  const selects = { shortsCountMode: $('#countMode'), commentDensity: $('#commentDensity') };
  const ranges = Object.fromEntries(['commentFontSize','commentLineHeight'].map(key => [key,$('#'+key)]));
  function rangeValue(key) {
    return KarmoDensity.number(key,values[key]);
  }
  function showRange(key, value) {
    const effective = key === 'commentLineHeight' ? Math.max(value,Number(ranges.commentFontSize.value)+4) : value;
    $('#'+key+'Value').textContent = effective + 'px';
    ranges[key].setAttribute('aria-valuetext',effective + 'px');
  }
  function announce(key) { status.textContent = msg(key); }
  function renderBlocks() {
    const term = $('#search').value.normalize('NFKC').toLowerCase().trim();
    const entries = Object.entries(values).filter(([key, value]) => key.startsWith('blockedChannel:') && Array.isArray(value?.ids));
    const visible = entries.filter(([, value]) => String(value.name || value.ids[0]).normalize('NFKC').toLowerCase().includes(term));
    $('#empty').textContent = msg(entries.length ? (visible.length ? 'blockLocalHint' : 'panelNoMatch') : 'panelNoBlocks');
    $('#blocked').replaceChildren();
    for (const [key, person] of visible.sort((a, b) => (b[1].created || 0) - (a[1].created || 0))) {
      const row = document.createElement('li'), name = document.createElement('span'), button = document.createElement('button');
      name.textContent = person.name || person.ids[0];
      button.type = 'button'; button.textContent = msg('unblockUser'); button.disabled = pending.has(key) || backupBusy;
      button.setAttribute('aria-label', msg('unblockUser') + ': ' + name.textContent);
      button.addEventListener('click', async () => {
        pending.add(key); button.disabled = true;
        const version = changeVersion;
        try { await chrome.storage.local.remove(key); if (version === changeVersion) delete values[key]; announce('panelUnblocked'); }
        catch { announce('panelSaveError'); }
        finally { pending.delete(key); renderBlocks(); $('#search').focus(); }
      });
      row.append(name, button); $('#blocked').append(row);
    }
  }
  function render() {
    for (const [key, input] of Object.entries(toggles)) {
      if (!pending.has(key)) input.checked = (key === 'shortsDate' ? syncValues : values)[key] !== false;
      input.disabled = !loaded || pending.has(key) || backupBusy;
    }
    words.disabled = $('#search').disabled = !loaded;
    $('#save').disabled = !loaded || !dirty || savingWords || backupBusy;
    for (const [key, select] of Object.entries(selects)) {
      select.disabled = !loaded || pending.has(key) || backupBusy;
      if (!pending.has(key)) select.value = key === 'commentDensity' ? KarmoDensity.commentMode(values[key]) : values[key] || 'both';
    }
    for (const [key,input] of Object.entries(ranges)) {
      input.disabled = !loaded || backupBusy || pending.has(key) || KarmoDensity.commentMode(values.commentDensity) !== 'compact';
      if (!pending.has(key)) { input.value = rangeValue(key); showRange(key,Number(input.value)); }
    }
    $('#export').disabled = $('#importFile').disabled = !loaded || backupBusy;
    $('#restore').disabled = !loaded || !selectedBackup || backupBusy || savingWords || pending.size > 0;
    if (loaded && !dirty && !savingWords) words.value = (values.keywordWords || []).join('\n');
    renderBlocks();
    renderReview();
  }
  async function load() {
    if (loading) return;
    loading = true; $('#retry').hidden = true; announce('panelLoading');
    const version = changeVersion;
    try {
      const [result, sync] = await Promise.all([chrome.storage.local.get(null), chrome.storage.sync.get({ shortsDate: true })]);
      if (version !== changeVersion) { loading = false; return load(); }
      values = result; syncValues = sync; loaded = true; status.textContent = ''; render();
    } catch { announce('panelLoadError'); $('#retry').hidden = false; }
    finally { loading = false; }
  }
  function close(restoreFocus = true) {
    panel.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && trigger.isConnected) trigger.focus();
  }
  trigger.addEventListener('click', () => {
    if (!panel.hidden) { close(); return; }
    panel.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    $('#close').focus(); if (!loaded) void load();
  });
  $('#close').addEventListener('click', () => close());
  shadow.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); } });
  shadow.addEventListener('keyup', event => event.stopPropagation());
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !event.composedPath().includes(host) && !event.composedPath().includes(trigger)) close(false);
  });
  $('#retry').addEventListener('click', () => void load());
  $('#search').addEventListener('input', renderBlocks);
  words.addEventListener('input', () => { dirty = true; draftVersion++; $('#save').disabled = savingWords; announce('panelUnsaved'); });
  $('#save').addEventListener('click', async () => {
    let parsed;
    try { parsed = KarmoKeywords.parse(words.value); } catch { announce('keywordError'); return; }
    const version = draftVersion, storageVersion = changeVersion; savingWords = true; render();
    try {
      await chrome.storage.local.set({ keywordWords: parsed });
      if (storageVersion === changeVersion) values.keywordWords = parsed;
      if (version === draftVersion) { dirty = false; words.value = parsed.join('\n'); announce('panelSaved'); }
      else announce('panelUnsaved');
    } catch { announce('panelSaveError'); }
    finally { savingWords = false; render(); }
  });
  for (const [key, input] of Object.entries(toggles)) input.addEventListener('change', async () => {
    const checked = input.checked; pending.add(key); render();
    const version = changeVersion;
    const area = key === 'shortsDate' ? 'sync' : 'local';
    try { await chrome.storage[area].set({ [key]: checked }); if (version === changeVersion) (area === 'sync' ? syncValues : values)[key] = checked; announce('panelSaved'); }
    catch { announce('panelSaveError'); }
    finally { pending.delete(key); render(); }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (!['local', 'sync'].includes(area)) return;
    const entries = Object.entries(changes).filter(([key]) => area === 'sync' ? key === 'shortsDate' : key.startsWith('blockedChannel:') || Object.hasOwn(toggles, key) || Object.hasOwn(selects, key) || Object.hasOwn(ranges,key) || key === 'keywordWords');
    if (!entries.length) return;
    changeVersion++;
    const target = area === 'sync' ? syncValues : values;
    for (const [key, change] of entries) {
      if (change.newValue === undefined) delete target[key]; else target[key] = change.newValue;
    }
    if (loaded) render();
  });
  for (const [key, select] of Object.entries(selects)) select.addEventListener('change', async () => {
    const value = select.value, version = changeVersion;
    pending.add(key); render();
    try { await chrome.storage.local.set({ [key]: value }); if (version === changeVersion) values[key] = value; announce('panelSaved'); }
    catch { announce('panelSaveError'); }
    finally { pending.delete(key); render(); }
  });
  for (const [key,input] of Object.entries(ranges)) {
    const patch = () => ({ [key]:KarmoDensity.number(key,Number(input.value)) });
    input.addEventListener('input', () => {
      showRange(key,Number(input.value));
      if (key === 'commentFontSize') showRange('commentLineHeight',Number(ranges.commentLineHeight.value));
      globalThis.KarmoDensityLayout?.preview(patch());
    });
    input.addEventListener('change', async () => {
      const update = patch(), version = changeVersion;
      pending.add(key); render();
      try { await chrome.storage.local.set(update); if (version === changeVersion) Object.assign(values,update); announce('panelSaved'); }
      catch { announce('panelSaveError'); }
      finally {
        pending.delete(key); render();
        globalThis.KarmoDensityLayout?.preview({ commentDensity:KarmoDensity.commentMode(values.commentDensity), ...Object.fromEntries(Object.keys(ranges).map(k=>[k,KarmoDensity.number(k,values[k])])) });
      }
    });
  }
  $('#export').addEventListener('click', async () => {
    backupBusy = true; render();
    let url;
    try {
      const [local, sync] = await Promise.all([chrome.storage.local.get(null), chrome.storage.sync.get(null)]);
      const data = KarmoSettingsBackup.create(local, sync);
      url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type:'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'karmolab-youtube-' + new Date().toISOString().slice(0,10) + '.json';
      shadow.append(link); link.click(); link.remove(); announce('backupExported');
    } catch { announce('backupExportError'); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 60000); backupBusy = false; render(); }
  });
  $('#importFile').addEventListener('change', async () => {
    const version = ++fileVersion, file = $('#importFile').files[0]; selectedBackup = null; $('#preview').textContent = ''; render();
    if (!file) return;
    try {
      if (file.size > KarmoSettingsBackup.maxBytes) throw Error('File too large');
      const parsed = KarmoSettingsBackup.parse(await file.text());
      if (version !== fileVersion) return;
      selectedBackup = parsed;
      $('#preview').textContent = chrome.i18n.getMessage('backupPreview', [String(Object.keys(parsed.settings).length), String(parsed.blocks.length)]);
    } catch { if (version === fileVersion) announce('backupInvalid'); }
    finally { if (version === fileVersion) render(); }
  });
  $('#restore').addEventListener('click', async () => {
    if (!selectedBackup || backupBusy) return;
    backupBusy = true; render();
    try {
      await KarmoSettingsBackup.restore(selectedBackup, chrome.storage);
      selectedBackup = null; $('#importFile').value = ''; $('#preview').textContent = '';
      announce(dirty ? 'backupRestoredDraft' : 'backupRestored');
    } catch (error) { announce(error.partial ? 'backupPartialError' : 'backupRestoreError'); }
    finally { backupBusy = false; render(); }
  });
  function mount() {
    const target = document.querySelector('ytd-masthead #buttons');
    if (target && trigger.parentElement !== target) target.prepend(trigger);
    if (!host.isConnected) document.documentElement.append(host);
  }
  new MutationObserver(() => {
    if (mountTimer || (host.isConnected && trigger.isConnected)) return;
    mountTimer = setTimeout(() => { mountTimer = undefined; mount(); }, 100);
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('yt-navigate-start', () => close(false));
  document.addEventListener('yt-navigate-finish', mount);
  mount();
})();
