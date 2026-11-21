import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function setup(initial) {
  const data = structuredClone(initial);
  const storage = {
    async get(defaults) {
      if (typeof defaults === 'string') return { [defaults]: structuredClone(data[defaults]) };
      return structuredClone(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, data[key] ?? value])));
    },
    async set(fields) { Object.assign(data, structuredClone(fields)); },
  };
  const sandbox = vm.createContext({ chrome: { storage: { local: storage } }, structuredClone });
  for (const file of ['keyword-core.js', 'arca/block-store.js']) {
    vm.runInContext(await readFile(new URL('../features/' + file, import.meta.url), 'utf8'), sandbox);
  }
  return { data, apply: sandbox.KarmoBlockStore.apply };
}

test('migration combines both legacy Arca formats and preserves other settings and explicitly removed keywords', async () => {
  const { data, apply } = await setup({
    keywordWords: ['Common', 'youtube'],
    karmoSettings: { keywords: ['flat'], arca: { keywords: ['COMMON', 'arca', 're:^\\s', 're:^\\S'], insight: false } },
    blocklist: { arca: { author: { name: 'Author' } } },
  });
  await apply({ op: 'migrateKeywords' });
  assert.deepEqual(data.keywordWords, ['Common', 'youtube', 'arca', 're:^\\s', 're:^\\S', 'flat']);
  assert.deepEqual(data.karmoSettings, { arca: { insight: false } });
  assert.deepEqual(data.blocklist, { arca: { author: { name: 'Author' } } });
  await apply({ op: 'keywordRemove', word: 'arca' });
  await apply({ op: 'migrateKeywords' });
  assert.ok(!data.keywordWords.includes('arca'));
});

test('DC title auto-blocks are idempotent, respect current shared rules and stay removed after unblock', async () => {
  const { data, apply } = await setup({
    keywordWords: ['common', 'hide only'], keywordAutoBlockWords: ['COMMON', 'deleted'],
    blocklist: { dcinside: { manual: { name: 'Manual' } } },
  });
  const candidates = [
    { key: 'author', name: 'Author', word: 'common' },
    { key: 'manual', name: 'Manual', word: 'common' },
    { key: 'hideonly', name: 'Hide only', word: 'hide only' },
    { key: 'stale', name: 'Stale', word: 'deleted' },
  ];
  const auto = () => apply({ op: 'dcKeywordBlocks', site: 'dcinside', candidates });
  const results = await Promise.all([auto(), auto()]);
  assert.deepEqual(results.map(result => result.added), [1, 0]);
  assert.deepEqual(Object.keys(data.blocklist.dcinside).sort(), ['author', 'manual']);
  assert.equal(data.blocklist.dcinside.author.autoKeyword, 'common');
  assert.deepEqual(data.blocklist.dcinside.manual, { name: 'Manual' });
  await apply({ op: 'remove', site: 'dcinside', key: 'author' });
  assert.equal((await auto()).added, 0);
  assert.deepEqual(data.karmoSettings.dcinside.autoAllowKeys, ['author']);
});

test('old Arca backups merge keywords into the shared list and DC blocks remain in their own namespace', async () => {
  const { data, apply } = await setup({ keywordWords: ['existing'] });
  await Promise.all([
    apply({ op: 'import', data: { settings: { arca: { keywords: ['restored', 'EXISTING'], minRec: 7 } } } }),
    apply({ op: 'block', site: 'dcinside', key: 'test123', name: 'Test' }),
  ]);
  assert.deepEqual(data.keywordWords, ['existing', 'restored']);
  assert.deepEqual(data.karmoSettings.arca, { minRec: 7 });
  assert.equal(data.blocklist.dcinside.test123.name, 'Test');
  assert.equal(data.blocklist.arca.test123, undefined);
});
