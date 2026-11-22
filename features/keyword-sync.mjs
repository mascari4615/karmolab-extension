import { createSyncSnapshot } from './sync-snapshot.mjs';

const listKeys = ['keywordWords', 'keywordAutoBlockWords'];

function lists(value) {
  const keywordWords = KarmoKeywords.merge(value.keywordWords);
  return { keywordWords, keywordAutoBlockWords: KarmoKeywords.automatic(keywordWords, value.keywordAutoBlockWords) };
}

export function createKeywordSync(storage) {
  const snapshot = createSyncSnapshot(storage.sync, 'karmolabKeywords');
  async function remote() {
    const result = await snapshot.remote();
    if (!result) return null;
    return { ...result, value: lists({
      keywordWords: result.rows.map(([word]) => word),
      keywordAutoBlockWords: result.rows.filter(([, automatic]) => automatic === true).map(([word]) => word)
    }) };
  }
  const publish = (value, previous) => {
    const selected = new Set(value.keywordAutoBlockWords);
    return snapshot.publish(value.keywordWords.map(word => [word, selected.has(word)]), previous);
  };

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

  return { commit, toggle, receive, changed: snapshot.changed };
}
