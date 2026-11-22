import assert from 'node:assert/strict';
import test from 'node:test';
import keywordsApi from '../features/keyword-core.js';
import '../features/dcinside/gallery.js';
import { createKeywordSync } from '../features/keyword-sync.mjs';
import { createBlockSync } from '../features/block-sync.mjs';
globalThis.KarmoKeywords = keywordsApi;

function area(initial = {}, checkSize = false) {
  const data = structuredClone(initial);
  return {
    data,
    async get(keys) {
      const selected = typeof keys === 'string' ? [keys] : keys || Object.keys(data);
      return Object.fromEntries(selected.filter(key => Object.hasOwn(data, key)).map(key => [key, structuredClone(data[key])]));
    },
    async set(patch) {
      for (const [key, value] of Object.entries(patch)) {
        if (checkSize) assert.ok(Buffer.byteLength(key + JSON.stringify(value)) < 8192, 'per-item storage quota');
      }
      Object.assign(data, structuredClone(patch));
    },
    async remove(keys) { for (const key of keys) delete data[key]; },
  };
}

test('sync requires per-device opt-in, merges first use and propagates later edits and deletions', async () => {
  const sync = area({}, true);
  const localA = area({ keywordWords: ['A'], keywordAutoBlockWords: ['A'] });
  const localB = area({ keywordWords: ['B'], keywordAutoBlockWords: ['B'] });
  const a = createKeywordSync({ local: localA, sync });
  const b = createKeywordSync({ local: localB, sync });
  await a.commit({ keywordWords: ['A', 'C'] });
  assert.deepEqual(sync.data, {});
  await a.toggle(true);
  await b.receive();
  assert.deepEqual(localB.data.keywordWords, ['B']);
  await b.toggle(true);
  await a.receive();
  assert.deepEqual(localA.data.keywordWords, ['A', 'C', 'B']);
  assert.deepEqual(localA.data.keywordAutoBlockWords, ['A', 'B']);
  await b.commit({ keywordWords: ['C'] });
  await assert.rejects(a.commit({ keywordWords: ['stale draft'] }), /다른 기기의 키워드/);
  assert.deepEqual(localA.data.keywordWords, ['C']);
  assert.deepEqual(localA.data.keywordAutoBlockWords, []);
  await a.toggle(false);
  await b.commit({ keywordWords: ['after'] });
  await a.receive();
  assert.deepEqual(localA.data.keywordWords, ['C']);
});

test('author blocks and DC galleries merge across devices and removals propagate without touching other settings', async () => {
  const sync = area({}, true);
  const youtube = { ids: ['@first', 'UCchannel'], name: 'First', created: 10 };
  const arca = { name: 'Arca', hideAll: true, reason: 'Review', autoChannel: 'channel' };
  const dc = { name: 'DC', autoKeyword: 'test' };
  const localA = area({
    keywordSyncEnabled: true, 'blockedChannel:@first': youtube,
    blocklist: { arca: { arcaUser: arca } },
    karmoSettings: { arca: { autoBlockChannels: ['channel'], blockedChannels: ['unrelated-channel'] } }
  });
  const localB = area({
    keywordSyncEnabled: true,
    blocklist: { dcinside: { dcUser: dc }, other: { otherUser: {} } },
    karmoSettings: { dcinside: { blockedChannels: ['game_dev'] }, arca: { minRec: 4 } },
    likelist: { arca: { favorite: {} } }, 'hiddenHomeChannel:@home': { name: 'Home' }
  });
  const a = createBlockSync({ local: localA, sync });
  const b = createBlockSync({ local: localB, sync });
  await a.run();
  assert.deepEqual(sync.data, {});
  await a.run(true);
  await b.run(true);
  await a.run();
  assert.deepEqual(localA.data.blocklist.dcinside.dcUser, dc);
  assert.deepEqual(localA.data.karmoSettings.dcinside.blockedChannels, ['game_dev']);
  assert.deepEqual(localA.data.karmoSettings.arca.blockedChannels, ['unrelated-channel']);
  assert.deepEqual(localB.data['blockedChannel:@first'], youtube);
  assert.deepEqual(localB.data.blocklist.arca.arcaUser, { name: 'Arca', hideAll: true, reason: 'Review' });
  assert.deepEqual(localA.data.blocklist.arca.arcaUser, arca);
  assert.equal(localB.data.karmoSettings.arca.minRec, 4);
  assert.ok(localB.data.likelist.arca.favorite);
  assert.ok(localB.data.blocklist.other.otherUser);
  assert.ok(localB.data['hiddenHomeChannel:@home']);
  assert.equal(localA.data['hiddenHomeChannel:@home'], undefined);

  await localA.remove(['blockedChannel:@first']);
  await localA.set({ 'keywordAutoBlockAllow:@first': { name: 'First', created: 123 } });
  delete localA.data.blocklist.arca.arcaUser;
  delete localB.data.blocklist.dcinside.dcUser;
  localB.data.karmoSettings.dcinside = { blockedChannels: [], autoAllowKeys: ['dcUser'] };
  await a.run();
  await b.run();
  await a.run();
  assert.ok(!localA.data.blocklist.dcinside.dcUser && !localB.data.blocklist.arca.arcaUser);
  assert.equal(localB.data['blockedChannel:@first'], undefined);
  assert.deepEqual(localB.data['keywordAutoBlockAllow:@first'], { name: 'First', created: 123 });
  assert.deepEqual(localA.data.karmoSettings.dcinside, { blockedChannels: [], autoAllowKeys: ['dcUser'] });

  await b.disable();
  await localA.set({ 'blockedChannel:@later': { ids: ['@later'], name: 'Later', created: 1 } });
  await a.run();
  await b.run();
  assert.equal(localB.data['blockedChannel:@later'], undefined);
});

test('large snapshots use multiple items and failed publishing preserves local data', async () => {
  const keywords = Array.from({ length: 40 }, (_, index) => index + '한'.repeat(180));
  const local = area();
  const sync = area({}, true);
  const store = createKeywordSync({ local, sync });
  await store.toggle(true);
  await store.commit({ keywordWords: keywords });
  assert.ok(sync.data.karmolabKeywords.count > 1);
  sync.set = async () => { throw Error('quota'); };
  await assert.rejects(store.commit({ keywordWords: ['new'] }), /동기화에 저장하지 못했습니다/);
  assert.deepEqual(local.data.keywordWords, keywords);
});

test('DC gallery uses one ID across desktop and mobile and rejects unrelated paths', () => {
  const gallery = globalThis.KarmoDcGallery;
  for (const url of [
    'https://gall.dcinside.com/mgallery/board/lists/?id=game_dev',
    'https://gall.dcinside.com/mgallery/board/view/?id=game_dev&no=1',
    'https://m.dcinside.com/board/game_dev/1',
  ]) assert.equal(gallery.parse(url), 'game_dev');
  assert.equal(gallery.fromUrl('/mini/board/view/?id=game_dev', 'https://gall.dcinside.com/'), 'game_dev');
  assert.equal(gallery.parse('Game_Dev'), 'game_dev');
  assert.equal(gallery.parse('https://other.example/board/game_dev'), '');
  assert.equal(gallery.parse('https://gall.dcinside.com/not-board/?id=game_dev'), '');
});
