(() => {
  globalThis.KarmoKeywordEditor = {
    create(textarea, changed) {
      const host = document.createElement('div'); host.id = 'kl-keyword-editor';
      const input = document.createElement('input'), add = document.createElement('button'), search = document.createElement('input'), list = document.createElement('ul'), error = document.createElement('p');
      input.type = 'text'; input.placeholder = '키워드 또는 이모지 추가'; input.setAttribute('aria-label', input.placeholder);
      input.style.cssText = 'flex:1;min-width:0;max-width:100%;box-sizing:border-box;background:transparent;color:inherit;border:1px solid #777;padding:8px;font:inherit';
      search.type = 'search'; search.placeholder = '키워드 검색'; search.setAttribute('aria-label', search.placeholder);
      add.type = 'button'; KarmoControlIcons.apply(add, 'add', '키워드 추가'); error.setAttribute('role', 'status');
      const row = document.createElement('div'); row.className = 'actions'; row.style.cssText = 'display:flex;flex-wrap:nowrap;gap:8px'; row.append(input, add); host.append(row, search, error, list);
      search.style.cssText = 'width:100%;box-sizing:border-box;margin-top:8px;background:transparent;color:inherit;border:1px solid #777;padding:8px;font:inherit';
      list.style.cssText = 'max-height:240px;overflow:auto';
      let automatic = [], disabled = true;
      const current = () => KarmoKeywords.parse(textarea.value);
      const commit = words => { textarea.value = words.join('\n'); error.textContent = ''; changed(); render(); };
      function render() {
        const words = current(), term = KarmoKeywords.normalize(search.value); list.replaceChildren();
        input.disabled = add.disabled = search.disabled = disabled;
        for (const word of words.filter(word => KarmoKeywords.normalize(word).includes(term))) {
          const item = document.createElement('li'), text = document.createElement('span'), auto = document.createElement('button'), remove = document.createElement('button');
          text.textContent = word; auto.type = remove.type = 'button';
          const active = automatic.some(value => KarmoKeywords.normalize(value) === KarmoKeywords.normalize(word));
          KarmoControlIcons.apply(auto, 'blocked', '작성자도 자동 차단: ' + word); auto.setAttribute('aria-pressed', String(active));
          auto.style.opacity = active ? '1' : '.45'; auto.disabled = remove.disabled = disabled;
          auto.addEventListener('click', () => { automatic = active ? automatic.filter(value => KarmoKeywords.normalize(value) !== KarmoKeywords.normalize(word)) : [...automatic, word]; changed(); render(); });
          KarmoControlIcons.apply(remove, 'close', '키워드 삭제: ' + word);
          remove.addEventListener('click', () => { automatic = automatic.filter(value => KarmoKeywords.normalize(value) !== KarmoKeywords.normalize(word)); commit(words.filter(value => value !== word)); input.focus(); });
          item.append(text, auto, remove); list.append(item);
        }
      }
      const append = () => { try { if (!input.value.trim()) return; const words = KarmoKeywords.parse([...current(), input.value].join('\n')); commit(words); input.value = ''; input.focus(); } catch { error.textContent = '키워드는 최대 200개, 항목당 200자'; } };
      add.addEventListener('click', append); input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); append(); } }); search.addEventListener('input', render);
      return { host, get automatic() { return automatic.filter(word => current().some(value => KarmoKeywords.normalize(value) === KarmoKeywords.normalize(word))); }, set(words, autoWords, locked) { textarea.value = words.join('\n'); automatic = [...autoWords]; disabled = locked; render(); }, lock(locked) { disabled = locked; render(); } };
    },
  };
})();
