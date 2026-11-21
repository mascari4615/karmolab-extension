import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function setup(initial) {
  const data = structuredClone(initial);
  const storage = {
    async get(defaults) {
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
