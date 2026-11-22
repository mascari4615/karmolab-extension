const byId = id => document.getElementById(id);
const words = byId('keywordText');
const save = byId('keywordSave');
const discard = byId('keywordDiscard');
const status = byId('keywordStatus');
const sync = byId('keywordSync');
const syncStatus = byId('keywordSyncStatus');
const blockSync = byId('blockListSync');
const blockStatus = byId('blockListSyncStatus');
const retryBlocks = byId('blockListSyncRetry');
const msg = key => chrome.i18n.getMessage(key);
const draftKey = 'youtubeKeywordDraft';
const keys = ['keywordWords', 'keywordAutoBlockWords', 'keywordSyncEnabled', 'blockSyncEnabled', 'blockSyncError'];
let current;
let base;
let dirty = false;
let busy = false;
let loads = 0;
let draftQueue = Promise.resolve();
const editor = KarmoKeywordEditor.create(words, () => {
  dirty = true;
  show('panelUnsaved');
  persist();
  render();
});
byId('keywordEditor').append(editor.host);
const entry = editor.host.querySelector('input[type=text]');
entry.addEventListener('input', persist);

function show(message) { status.textContent = msg(message); }
function saveDraft(draft) {
  draftQueue = draftQueue.catch(() => {}).then(() => chrome.storage.session.set({ [draftKey]: draft }));
  draftQueue.catch(() => show('panelSaveError'));
}
function persist() {
  queueMicrotask(() => saveDraft({ words: words.value, automatic: editor.automatic, entry: entry.value, base, dirty }));
}
function signature(snapshot) {
  return JSON.stringify([snapshot.keywordWords || [], snapshot.keywordAutoBlockWords || []]);
}
function render() {
  const locked = !current || busy;
  save.disabled = locked || !dirty;
  discard.disabled = sync.disabled = locked;
  blockSync.disabled = locked || !current?.keywordSyncEnabled;
  discard.hidden = !dirty;
  if (!busy) {
    sync.checked = current?.keywordSyncEnabled === true;
    blockSync.checked = current?.blockSyncEnabled === true && sync.checked;
  }
  retryBlocks.hidden = !current?.blockSyncError || !current?.keywordSyncEnabled || !current?.blockSyncEnabled;
  retryBlocks.disabled = locked;
  editor.lock(locked);
}
async function read() {
  const revision = ++loads;
  const data = await chrome.storage.local.get(keys);
  if (revision !== loads) return;
  current = data;
  blockStatus.textContent = data.keywordSyncEnabled && data.blockSyncEnabled ? data.blockSyncError || '' : '';
  if (!dirty) {
    base = signature(data);
    editor.set(data.keywordWords || [], data.keywordAutoBlockWords || [], busy);
  }
  render();
}
async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type: 'karmolab.keywords.' + type, ...payload });
  if (!response?.ok) throw Error(response?.error || msg('panelSaveError'));
}
async function action(callback) {
  busy = true;
  render();
  try { await callback(); }
  finally { busy = false; render(); }
}
save.addEventListener('click', () => action(async () => {
  let parsed;
  try { parsed = KarmoKeywords.parse(words.value); }
  catch { show('keywordError'); return; }
  try {
    await send('save', { words: parsed, autoWords: editor.automatic, base });
    dirty = false;
    await read();
    if (entry.value) persist(); else saveDraft(null);
    show('panelSaved');
  } catch (error) { status.textContent = error.message; }
}));
discard.addEventListener('click', () => {
  dirty = false;
  entry.value = '';
  saveDraft(null);
  read().then(() => { status.textContent = ''; }).catch(() => show('panelLoadError'));
});
sync.addEventListener('change', () => {
  const enabled = sync.checked;
  void action(async () => {
    try {
      await send('sync', { enabled });
      await read();
      syncStatus.textContent = enabled ? '브라우저 동기화를 켰습니다.' : '이 기기의 동기화를 껐습니다.';
    } catch (error) { syncStatus.textContent = error.message; }
  });
});
blockSync.addEventListener('change', () => {
  const enabled = blockSync.checked;
  void action(async () => {
    try {
      await send('blockSync', { enabled });
      await read();
      blockStatus.textContent = enabled ? '차단 목록 동기화를 켰습니다.' : '이 기기의 차단 목록 동기화를 껐습니다.';
    } catch (error) { blockStatus.textContent = error.message; }
  });
});
retryBlocks.addEventListener('click', () => action(async () => {
  try {
    await send('retryBlocks');
    await read();
    if (!current?.blockSyncError) blockStatus.textContent = '차단 목록을 동기화했습니다.';
  } catch (error) { blockStatus.textContent = error.message; }
}));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && keys.some(key => Object.hasOwn(changes, key))) read().catch(() => show('panelLoadError'));
});

try {
  await send('ready').catch(error => { syncStatus.textContent = error.message; });
  const { [draftKey]: draft } = await chrome.storage.session.get(draftKey);
  if (draft && !dirty) {
    dirty = draft.dirty !== false;
    base = draft.base;
    entry.value = draft.entry || '';
    if (dirty) {
      editor.set(String(draft.words || '').split('\n').filter(Boolean), draft.automatic || [], true);
      show('panelUnsaved');
    }
  }
  await read();
  if (dirty && !base && current) base = signature(current);
} catch { show('panelLoadError'); }
