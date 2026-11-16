import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const code = await readFile(new URL('../features/panel-background.mjs',import.meta.url),'utf8');
function setup(openPopup) {
  let listener; const stored=[];
  vm.runInNewContext(code,{chrome:{runtime:{id:'self',onMessage:{addListener(fn){listener=fn;}}},storage:{session:{async set(value){stored.push(value);}}},action:{openPopup}}});
  return {stored,send(message,sender){return new Promise(resolve=>{if(!listener(message,sender,resolve))resolve(null);});}};
}
const sender={id:'self',frameId:0,url:'https://www.youtube.com/watch?v=test',tab:{id:1,windowId:2}};
test('shortcut selects YouTube and opens the popup in its own window',async()=>{
  let windowId;const app=setup(async options=>{windowId=options.windowId;});
  assert.equal((await app.send({type:'karmolab.panel.open'},sender)).ok,true);
  assert.equal(windowId,2);assert.equal(app.stored[0].panelSection,'youtube');
});
test('unknown senders and child frames cannot open the extension panel',async()=>{
  const app=setup(async()=>assert.fail('must not open'));
  for(const patch of [{id:'other'},{frameId:1},{url:'https://example.com/'}]) assert.equal(await app.send({type:'karmolab.panel.open'},{...sender,...patch}),null);
});
test('unsupported or rejected popup opening returns a recoverable result',async()=>{
  for(const open of [undefined,async()=>{throw new Error('unsupported');}]) assert.equal((await setup(open).send({type:'karmolab.panel.open'},sender)).ok,false);
});
