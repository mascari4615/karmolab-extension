const header = 'karmolabKeywords';
const partKey = (revision, index) => `${header}:${revision}:${index}`;
const maxParts = 22;
const encoder = new TextEncoder();
const bytes = value => encoder.encode(JSON.stringify(value)).length;
const listKeys = ['keywordWords', 'keywordAutoBlockWords'];

function lists(value) {
  const keywordWords = KarmoKeywords.merge(value.keywordWords);
  return { keywordWords, keywordAutoBlockWords: KarmoKeywords.automatic(keywordWords, value.keywordAutoBlockWords) };
}

export function createKeywordSync(storage) {
  async function remote() {
    const { [header]: meta } = await storage.sync.get(header);
    if (!meta) return null;
    if (!Number.isInteger(meta.count) || meta.count < 0 || meta.count > maxParts) throw Error('동기화 목록을 읽지 못했습니다.');
    if (typeof meta.revision !== 'string' || !/^[\da-f-]{36}$/.test(meta.revision)) throw Error('동기화 목록을 읽지 못했습니다.');
    const parts = Array.from({ length: meta.count }, (_, index) => partKey(meta.revision, index));
    const data = await storage.sync.get(parts);
    const rows = [];
    for (let index = 0; index < meta.count; index++) {
      const part = data[parts[index]];
      if (!Array.isArray(part)) throw Error('다른 기기의 키워드를 받는 중입니다. 잠시 후 다시 시도하세요.');
      for (const row of part) {
        if (Array.isArray(row) && typeof row[0] === 'string') rows.push(row);
      }
    }
    return { parts, value: lists({
      keywordWords: rows.map(([word]) => word),
      keywordAutoBlockWords: rows.filter(([, automatic]) => automatic === true).map(([word]) => word)
    }) };
  }

  async function publish(value, previous) {
    const revision = crypto.randomUUID();
    const selected = new Set(value.keywordAutoBlockWords);
    const chunks = [];
    let rows = [];
    for (const word of value.keywordWords) {
      const row = [word, selected.has(word)];
      if (rows.length && bytes([...rows, row]) > 7600) { chunks.push(rows); rows = []; }
      rows.push(row);
    }
    if (rows.length) chunks.push(rows);
    if (chunks.length > maxParts) throw Error('키워드 목록이 브라우저 동기화 한도를 넘었습니다.');
    const patch = { [header]: { revision, count: chunks.length } };
    for (const [index, chunk] of chunks.entries()) patch[partKey(revision, index)] = chunk;
    try { await storage.sync.set(patch); }
    catch { throw Error('브라우저 동기화에 저장하지 못했습니다. 동기화 설정이나 저장 용량을 확인하세요.'); }
    if (previous?.parts.length) await storage.sync.remove(previous.parts).catch(console.warn);
  }

  async function commit(patch) {
    if (!listKeys.some(key => Object.hasOwn(patch, key))) return storage.local.set(patch);
    const current = await storage.local.get([...listKeys, 'keywordSyncEnabled']);
    if (!current.keywordSyncEnabled) return storage.local.set(patch);
    const previous = await remote();
    if (previous && JSON.stringify(lists(current)) !== JSON.stringify(previous.value)) {
      await storage.local.set(previous.value);
      throw Error('다른 기기의 키워드가 도착했습니다. 최신 목록을 확인하고 다시 저장하세요.');
    }
    const value = lists({ ...current, ...patch });
    if (JSON.stringify(value) !== JSON.stringify(previous?.value)) await publish(value, previous);
    return storage.local.set({ ...patch, ...value });
  }

  async function toggle(enabled) {
    if (!enabled) return storage.local.set({ keywordSyncEnabled: false });
    const [current, previous] = await Promise.all([storage.local.get(listKeys), remote()]);
    const value = lists({
      keywordWords: KarmoKeywords.merge(previous?.value.keywordWords, current.keywordWords),
      keywordAutoBlockWords: KarmoKeywords.merge(previous?.value.keywordAutoBlockWords, current.keywordAutoBlockWords)
    });
    if (JSON.stringify(value) !== JSON.stringify(previous?.value)) await publish(value, previous);
    await storage.local.set({ ...value, keywordSyncEnabled: true });
  }

  async function receive() {
    const current = await storage.local.get([...listKeys, 'keywordSyncEnabled']);
    if (!current.keywordSyncEnabled) return;
    const previous = await remote();
    if (previous && JSON.stringify(lists(current)) !== JSON.stringify(previous.value)) await storage.local.set(previous.value);
  }

  return { commit, toggle, receive, changed: changes => Object.keys(changes).some(key => key === header || key.startsWith(header + ':')) };
}
