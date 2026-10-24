const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../features/settings-backup.js');
const record = (id, name = '검증 사용자') => ({ key:'blockedChannel:' + id, name, ids:[id], created:123 });
const backup = (settings = {}, blocks = []) => ({ format:'karmolab-youtube-backup',version:1,settings,blocks });
function area(initial = {}) {
  const store = structuredClone(initial);
  return { store, get:async () => structuredClone(store), set:async patch => Object.assign(store, structuredClone(patch)), remove:async keys => { for (const key of [].concat(keys)) delete store[key]; } };
}
test('export includes effective defaults and excludes histories, permissions and unrelated storage', () => {
  const data = api.create({ 'shortsDayView:x':{}, volumeSites:{}, base64Sites:['https://example.com/*'], other:'private' }, {});
  assert.equal(Object.keys(data.settings).length,16);
  assert.equal(data.settings.commentDensity,'default');assert.equal(data.settings.homeDensity,'default');
  assert.equal(data.settings.shortsDate,true); assert.equal(data.settings.commentTranslate,true);
  assert.deepEqual(data.settings.keywordWords,[]); assert.equal(JSON.stringify(data).includes('private'),false);
  assert.deepEqual(api.parse(JSON.stringify(data)).blocks,[]);
});
test('backup round trip preserves Korean names, false settings and keywords', () => {
  const person=record('@한국어');
  const data=api.create({commentTranslate:false,keywordComments:false,keywordVideos:true,keywordShorts:false,keywordWords:['고양이'],[person.key]:person},{shortsDate:false});
  const parsed=api.parse(JSON.stringify(data));
  assert.equal(parsed.settings.shortsDate,false);assert.equal(parsed.blocks[0].name,'검증 사용자');assert.deepEqual(parsed.settings.keywordWords,['고양이']);
  assert.equal(parsed.settings.keywordComments,false);assert.equal(parsed.settings.keywordVideos,true);assert.equal(parsed.settings.keywordShorts,false);
});
test('invalid versions, structure, settings, modes and keywords rejected', () => {
  for (const data of [{...backup(),version:2},{...backup(),settings:42},backup({userBlock:'false'}),backup({shortsCountMode:'bad'}),backup({unknown:true}),backup({keywordWords:['a\nb']}),backup({keywordWords:['a'.repeat(201)]}),backup({keywordWords:Array.from({length:201},(_,i)=>String(i))})]) assert.throws(()=>api.parse(JSON.stringify(data)));
});
test('invalid user identities and duplicate keys rejected before restoring', () => {
  for(const records of [[record('@bad/path')],[record('@x\u0000')],[{...record('@x'),key:'__proto__'}],[record('@x'),record('@x')],[{...record('@x'),created:-1}]]) assert.throws(()=>api.parse(JSON.stringify(backup({},records))));
});
test('oversized and malformed JSON rejected', () => {
  assert.throws(()=>api.parse('x'.repeat(api.maxBytes+1))); assert.throws(()=>api.parse('{'));
});
test('restore merges users and aliases, preserves existing metadata and unrelated data', async () => {
  const old=record('@old'), same=record('@same','현재 이름');
  const local=area({[old.key]:old,[same.key]:same,keywordEnabled:true,history:'keep'}),sync=area({shortsDate:true,other:'keep'});
  const next={...record('@same','백업 이름'),ids:['@same','UC'+'a'.repeat(22)]};
  await api.restore(backup({shortsDate:false,keywordEnabled:false},[next,record('@new')]),{local,sync});
  assert.equal(local.store.history,'keep');assert.equal(local.store[old.key].name,old.name);assert.equal(local.store[same.key].name,'현재 이름');assert.equal(local.store[same.key].ids.length,2);
  assert.ok(local.store['blockedChannel:@new']);assert.equal(sync.store.shortsDate,false);assert.equal(sync.store.other,'keep');
});
test('sync failure rolls back local settings and removes only newly imported users', async () => {
  const local=area({keywordEnabled:true,other:'keep'}),sync=area({shortsDate:true});let writes=0;
  sync.set=async()=>{writes++;throw Error('offline');};
  await assert.rejects(api.restore(backup({keywordEnabled:false,shortsDate:false},[record('@new')]),{local,sync}),error=>error.partial===false);
  assert.deepEqual(local.store,{keywordEnabled:true,other:'keep'});assert.equal(writes,1);
});
test('a failed initial local write leaves sync unchanged', async () => {
  const local=area({keywordEnabled:true}),sync=area({shortsDate:true});local.set=async()=>{throw Error('quota');};
  await assert.rejects(api.restore(backup({keywordEnabled:false,shortsDate:false}),{local,sync}));assert.equal(sync.store.shortsDate,true);
});
test('rollback preserves newer values changed in another tab', async () => {
  const local=area({keywordWords:['before']}),sync=area({shortsDate:true});
  sync.set=async()=>{local.store.keywordWords=['newer input'];throw Error('offline');};
  await assert.rejects(api.restore(backup({keywordWords:['import'],shortsDate:false}),{local,sync}));assert.deepEqual(local.store.keywordWords,['newer input']);
});
test('rollback failure is reported as partial, without a false success', async () => {
  const local=area({keywordEnabled:true}),sync=area({shortsDate:true});const set=local.set;let count=0;
  local.set=async patch=>{if(++count>1)throw Error('rollback failed');return set(patch);};sync.set=async()=>{throw Error('offline');};
  await assert.rejects(api.restore(backup({keywordEnabled:false,shortsDate:false}),{local,sync}),error=>error.partial===true);
});
