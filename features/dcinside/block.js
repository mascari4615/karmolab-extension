(async () => {
  if (!(await chrome.runtime.sendMessage({ type: 'dcinside.running' }))?.enabled) return;
  const mobile = location.hostname === 'm.dcinside.com';
  const hidden = new Set();
  const controls = new Map();
  const pending = new Set();
  let frame = 0;
  let revision = 0;
  let values;
  const account = value => /^[a-z0-9_-]{1,64}$/i.test(value || '') ? value.toLowerCase() : '';
  const mobileId = writer => writer?.querySelector('a[href^="/gallog/"]')?.getAttribute('href').slice('/gallog/'.length);

  async function blockMatches(candidates) {
    const before = revision;
    for (const { key } of candidates) pending.add(key);
    try {
      const result = await chrome.runtime.sendMessage({ type: 'dcinside.keywordBlocks', candidates });
      if (!result?.ok) throw Error(result?.error);
    } catch (error) {
      console.warn('KarmoLab: DC Inside automatic block could not be saved', error);
    } finally {
      for (const { key } of candidates) pending.delete(key);
      if (revision !== before) schedule();
    }
  }

  function scan() {
    frame = 0;
    const seen = new Set();
    const nextHidden = new Set();
    const candidates = new Map();
    if (values?.dcinsideEnabled) {
      const blocks = values.blocklist?.dcinside || {};
      const words = KarmoKeywords.merge(values.keywordWords);
      const autoWords = KarmoKeywords.automatic(words, values.keywordAutoBlockWords);
      const allowed = new Set(values.karmoSettings?.dcinside?.autoAllowKeys || []);
      const blocked = key => key && Object.hasOwn(blocks, key);
      const inspect = (anchor, uid, name, target, textNode, isPost = false) => {
        const key = account(uid);
        const text = textNode?.textContent || '';
        const keyword = text && KarmoKeywords.match(text, words);
        if (blocked(key) || keyword) {
          nextHidden.add(target);
          if (keyword && isPost && key && !blocked(key) && !allowed.has(key) && !pending.has(key) && !candidates.has(key)) {
            const word = KarmoKeywords.match(text, autoWords);
            if (word) candidates.set(key, { key, name: name?.trim() || key, word });
          }
          return;
        }
        if (!key || !anchor) return;
        seen.add(anchor);
        const previous = controls.get(anchor);
        if (previous?.dataset.account === key && previous.isConnected) return;
        previous?.remove();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'kl-dc-block';
        button.dataset.account = key;
        button.textContent = chrome.i18n.getMessage('dcinsideBlock');
        button.addEventListener('click', async event => {
          if (!event.isTrusted) return;
          event.preventDefault();
          event.stopPropagation();
          button.disabled = true;
          try {
            const result = await chrome.runtime.sendMessage({ type: 'dcinside.block', key, name: name?.trim() || key });
            if (!result?.ok) throw Error(result?.error);
          } catch {
            button.textContent = chrome.i18n.getMessage('dcinsideRetry');
          } finally { button.disabled = false; }
        });
        anchor.append(button);
        controls.set(anchor, button);
      };

      if (mobile) {
        for (const row of document.querySelectorAll('.gall-detail-lst > li')) {
          const title = row.querySelector('.subjectin');
          const writer = row.querySelector('.blockInfo');
          inspect(row.querySelector('.gall-detail-lnktb'), writer?.dataset.info, writer?.dataset.name, row, title, true);
        }
        for (const row of document.querySelectorAll('#comment_box li[id^="comment_cnt_"]')) {
          const writer = row.querySelector('.ginfo-area');
          inspect(writer, mobileId(writer), writer?.querySelector('.nick')?.textContent, row, row.querySelector(':scope > .txt'));
        }
      } else {
        for (const row of document.querySelectorAll('tr.ub-content[data-no]')) {
          if (row.dataset.type === 'icon_notice') continue;
          const writer = row.querySelector('.gall_writer');
          inspect(writer, writer?.dataset.uid, writer?.dataset.nick, row, row.querySelector('.gall_tit > a'), true);
        }
        for (const row of document.querySelectorAll('.cmt_info, .reply_info')) {
          const writer = row.querySelector('.gall_writer');
          inspect(writer?.parentElement, writer?.dataset.uid, writer?.dataset.nick, row, row.querySelector('.usertxt, .coment_dccon_txt'));
        }
      }
    }
    for (const element of hidden) if (!nextHidden.has(element)) {
      element.classList.remove('kl-dc-hidden');
      hidden.delete(element);
    }
    for (const element of nextHidden) {
      element.classList.add('kl-dc-hidden');
      hidden.add(element);
    }
    for (const [element, button] of controls) if (!seen.has(element)) {
      button.remove();
      controls.delete(element);
    }
    if (candidates.size) void blockMatches([...candidates.values()]);
  }

  const schedule = () => { if (!frame) frame = requestAnimationFrame(scan); };
  async function read() {
    const current = ++revision;
    const settings = await chrome.storage.local.get(['dcinsideEnabled', 'blocklist', 'keywordWords', 'keywordAutoBlockWords', 'karmoSettings']);
    if (current !== revision) return;
    values = settings;
    schedule();
  }
  const refresh = () => read().catch(console.error);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.dcinsideEnabled || changes.blocklist || changes.keywordWords || changes.keywordAutoBlockWords || changes.karmoSettings)) refresh();
  });
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-uid', 'data-info']
  });
  await read();
})().catch(console.error);
