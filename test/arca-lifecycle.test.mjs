import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const code = (await read('features/arca/background.mjs')).replace(/^import .*;\r?\n/gm, '');
async function system({ permission = true, failRegister = false, enabled = false } = {}) {
  const data = { arcaFeature: { enabled, migrated:true, at:123 }, blocklist:{arca:{a:{hideAll:true}}}, likelist:{arca:{b:{}}}, karmoSettings:{arca:{blockedChannels:['test']}}, 'karmoVisited:test:1':100 };
  const scripts=[]; let handler; const event=()=>({addListener(){}});
  const chrome={
    runtime:{id:'self',getURL:f=>'chrome-extension://self/'+f,onStartup:event(),onInstalled:event(),onMessage:{addListener(fn){handler=fn;}},sendMessage(){assert.fail('No cross-extension transfer permitted');}},
    storage:{local:{async get(k){return typeof k==='string'?{[k]:structuredClone(data[k])}:structuredClone(data);},async set(v){Object.assign(data,structuredClone(v));},async remove(){assert.fail('Activation must preserve data');}}},
    permissions:{async contains(){return permission;},onRemoved:event()},
    scripting:{async getRegisteredContentScripts(){return scripts;},async registerContentScripts(items){if(failRegister)throw Error('registration failed');scripts.push(...items);},async unregisterContentScripts(){scripts.length=0;}},
  };
  const sandbox = vm.createContext({ chrome, console, Date, structuredClone });
  for (const file of ['features/keyword-core.js', 'features/arca/block-store.js']) vm.runInContext(await read(file), sandbox);
  vm.runInContext(code, sandbox);
  const send=(type,sender={id:'self',url:chrome.runtime.getURL('popup.html')})=>new Promise(resolve=>{if(!handler({type},sender,resolve))resolve(undefined);});
  await send('arca.feature.status');
  return {data,scripts,send};
}
test('enable and disable preserve migrated records without contacting Dev',async()=>{
  const s=await system();const before=structuredClone(s.data);
  assert.equal((await s.send('arca.feature.enable')).ok,true);assert.equal(s.scripts.length,1);
  assert.equal((await s.send('arca.feature.disable')).ok,true);assert.equal(s.scripts.length,0);
  assert.deepEqual(s.data,before);
  delete s.data.blocklist.arca.a;s.data.karmoSettings.arca.blockedChannels=[];
  await s.send('arca.feature.enable');assert.deepEqual(s.data.blocklist.arca,{});assert.deepEqual(s.data.karmoSettings.arca.blockedChannels,[]);
});
test('activation requires permission and popup sender',async()=>{
  const s=await system({permission:false});assert.equal((await s.send('arca.feature.enable')).ok,false);assert.equal(s.data.arcaFeature.enabled,false);
  const t=await system();assert.equal((await t.send('arca.feature.enable',{id:'self',url:'https://arca.live/'})).ok,false);
  assert.equal(await t.send('arca.feature.enable',{id:'other'}),undefined);
});
test('registration failure restores the feature state and keeps records',async()=>{
  const s=await system({failRegister:true});const before=structuredClone(s.data);
  assert.equal((await s.send('arca.feature.enable')).ok,false);assert.deepEqual(s.data,before);
});
test('transfer message no longer has a supported path',async()=>{
  const s=await system({enabled:true});assert.equal((await s.send('arca.transfer.prepare')).ok,false);
});
