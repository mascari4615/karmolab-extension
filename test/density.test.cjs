const test = require('node:test');
const assert = require('node:assert/strict');
const density = require('../features/density-core.js');
const backups = require('../features/settings-backup.js');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../features/density.js'),'utf8');
function page(write = async()=>{}) {
  let resolveGet, changed, resized;
  const attrs=new Map(), styles=new Map([['--ytd-rich-grid-items-per-row','3']]), events={};
  const grid={isConnected:true,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getBoundingClientRect:()=>({width:1200}),style:{getPropertyValue:k=>styles.get(k)||'',setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)}};
  const rootStyles=new Map();
  const html={dataset:{},toggleAttribute:()=>{},style:{setProperty:(key,value)=>rootStyles.set(key,value)}}, location={pathname:'/'};
  const context={KarmoDensity:density,location,console,document:{documentElement:html,querySelector:()=>grid,querySelectorAll:()=>[],addEventListener:(k,v)=>{events[k]=v;}},ResizeObserver:class{constructor(cb){resized=cb;}observe(){}disconnect(){}},MutationObserver:class{observe(){}},setTimeout:()=>1,chrome:{storage:{local:{get:()=>new Promise(resolve=>{resolveGet=resolve;}),set:write},onChanged:{addListener:fn=>{changed=fn;}}}}};
  vm.runInNewContext(source,context);
  return {grid,attrs,styles,html,events,location,rootStyles,selectHome:(mode,count)=>context.KarmoDensityLayout.selectHome(mode,count),subscribe:fn=>context.KarmoDensityLayout.subscribeHome(fn),preview:patch=>context.KarmoDensityLayout.preview(patch),load:async values=>{resolveGet(values);await Promise.resolve();},change:values=>changed(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{newValue:v}])),'local'),resize:()=>resized()};
}
test('unknown modes return native layout', () => {
  assert.equal(density.commentMode('compact'),'compact');assert.equal(density.commentMode('invalid'),'default');
  assert.equal(density.homeMode('small'),'small');assert.equal(density.homeMode(undefined),'default');
});
test('edited marker is separated without changing ordinary date text', () => {
  assert.deepEqual(density.publishedTime(' 3일 전(수정됨) '),{text:'3D',edited:true});
  assert.deepEqual(density.publishedTime('2 days ago (edited)'),{text:'2D',edited:true});
  assert.deepEqual(density.publishedTime('1시간 전'),{text:'1h',edited:false});
  assert.deepEqual(density.publishedTime('1개월 전'),{text:'1M',edited:false});
  assert.deepEqual(density.publishedTime('2주 전'),{text:'2W',edited:false});
  assert.deepEqual(density.publishedTime('5 minutes ago'),{text:'5m',edited:false});
  assert.deepEqual(density.publishedTime('5 months ago'),{text:'5M',edited:false});
  assert.deepEqual(density.publishedTime('3일 전 (다른 정보)'),{text:'3일 전 (다른 정보)',edited:false});
});
test('size ranges normalize invalid input and requested columns stay stable across desktop widths', () => {
  assert.equal(density.number('commentFontSize',NaN),15);
  assert.equal(density.number('commentFontSize',99),20);
  assert.equal(density.number('commentFontSize',1),12);
  assert.equal(density.number('commentLineHeight',23),24);
  for(const width of [1200,1657,2300,4000]) assert.equal(density.columns(width,'custom',4),4);
  assert.equal(density.columns(1657,'custom',2),2);
  assert.equal(density.columns(375,'custom',6),1);
  assert.deepEqual(density.homeChoice({homeDensity:'custom',homeCardWidth:220}),{homeDensity:'custom',homeColumns:6});
  assert.deepEqual(density.homeChoice({homeDensity:'custom',homeCardWidth:400}),{homeDensity:'custom',homeColumns:3});
});
test('numeric preferences survive backups and reject invalid ranges and steps', () => {
  const local={commentFontSize:18,commentLineHeight:26,homeColumns:5,homeDensity:'custom'};
  const data=backups.create(local,{});
  for(const [key,value] of Object.entries(local)) assert.equal(backups.parse(JSON.stringify(data)).settings[key],value);
  for(const [key,value] of [['commentFontSize',21],['commentLineHeight',23],['homeColumns',7],['homeColumns','4'],['homeColumns',2.5],['homeCardWidth',175]]) {
    assert.throws(()=>backups.parse(JSON.stringify({...data,settings:{[key]:value}})));
  }
});
test('preview is immediate, line height remains readable, and late reads cannot overwrite it', async () => {
  const p=page();p.preview({commentDensity:'compact',commentFontSize:20,commentLineHeight:18,homeDensity:'custom',homeColumns:2});
  await p.load({commentFontSize:15,commentLineHeight:22,homeDensity:'small',homeCardWidth:260});
  assert.equal(p.rootStyles.get('--kl-comment-font-size'),'20px');
  assert.equal(p.rootStyles.get('--kl-comment-line-height'),'24px');
  assert.equal(p.styles.get('--kl-home-columns'),'2');
  p.change({commentFontSize:15,commentLineHeight:22,homeDensity:'small'});
  assert.equal(p.rootStyles.get('--kl-comment-font-size'),'15px');assert.equal(p.styles.get('--kl-home-columns'),'4');
});
test('home columns fit each target width, stay bounded and increase with denser modes', () => {
  assert.equal(density.columns(1200,'small'),4);assert.equal(density.columns(1200,'compact'),5);
  for (const width of [0,320,390,600,900,1200,1657,4000]) {
    const small=density.columns(width,'small'),compact=density.columns(width,'compact');
    assert.ok(small>=1&&small<=8);assert.ok(compact>=small&&compact<=8);
  }
  assert.equal(density.columns(320,'small'),1);assert.equal(density.columns(390,'compact'),1);
});
test('density settings round trip through backups and invalid modes are rejected', async () => {
  const data=backups.create({commentDensity:'compact',homeDensity:'small'},{});
  const parsed=backups.parse(JSON.stringify(data));assert.equal(parsed.settings.commentDensity,'compact');assert.equal(parsed.settings.homeDensity,'custom');assert.equal(parsed.settings.homeColumns,4);
  assert.throws(()=>backups.parse(JSON.stringify({...data,settings:{commentDensity:'tiny'}})));
  assert.throws(()=>backups.parse(JSON.stringify({...data,settings:{homeDensity:5}})));
});
test('live density changes, resize, navigation and default restoration preserve native styles', async () => {
  const p=page();await p.load({commentDensity:'compact',homeDensity:'small'});
  assert.equal(p.html.dataset.klCommentDensity,'compact');assert.equal(p.styles.get('--kl-home-columns'),'4');
  p.change({homeDensity:'compact'});assert.equal(p.styles.get('--kl-home-columns'),'5');
  p.grid.getBoundingClientRect=()=>({width:390});p.resize();assert.equal(p.styles.get('--kl-home-columns'),'1');
  p.location.pathname='/results';p.events['yt-navigate-finish']();assert.equal(p.attrs.has('data-kl-home-grid'),false);assert.equal(p.styles.has('--kl-home-columns'),false);
  p.location.pathname='/';p.events['yt-navigate-finish']();assert.equal(p.attrs.get('data-kl-home-grid'),'custom');
  p.change({homeDensity:'default',commentDensity:'default'});assert.equal(p.attrs.has('data-kl-home-grid'),false);assert.equal(p.html.dataset.klCommentDensity,'default');assert.equal(p.styles.get('--ytd-rich-grid-items-per-row'),'3');
});
test('late initial settings do not overwrite newer changes from the panel', async () => {
  const p=page();p.change({homeDensity:'compact'});await p.load({homeDensity:'default',commentDensity:'compact'});
  assert.equal(p.attrs.get('data-kl-home-grid'),'custom');assert.equal(p.html.dataset.klCommentDensity,'compact');
});
test('home selection previews before saving and latest failed save restores the last acknowledged choice', async()=> {
  let release,fail=false;const writes=[];
  const p=page(async patch=>{writes.push({...patch});if(writes.length===1)await new Promise(resolve=>{release=resolve;});if(fail)throw Error('disk');});
  await p.load({homeDensity:'small'});
  const first=p.selectHome('custom',3);await Promise.resolve();
  const second=p.selectHome('custom',4);
  assert.equal(p.styles.get('--kl-home-columns'),'4');assert.equal(writes.length,1);
  release();await first;await second;assert.equal(writes[1].homeColumns,4);
  fail=true;const failed=p.selectHome('custom',2);assert.equal(p.styles.get('--kl-home-columns'),'2');
  await assert.rejects(failed);assert.equal(p.styles.get('--kl-home-columns'),'4');
});
test('legacy backups migrate pixel width without retaining an active pixel setting',()=> {
  const data=backups.parse(JSON.stringify({format:'karmolab-youtube-backup',version:1,settings:{homeDensity:'custom',homeCardWidth:220},blocks:[]}));
  assert.equal(data.settings.homeColumns,6);assert.equal(Object.hasOwn(data.settings,'homeCardWidth'),false);
});
test('old backups without density keys preserve current layout preferences', async () => {
  const localValues={commentDensity:'compact',homeDensity:'small',commentFontSize:18,commentLineHeight:26,homeCardWidth:220};
  const area=values=>({get:async()=>({...values}),set:async patch=>Object.assign(values,patch),remove:async()=>{}});
  await backups.restore({format:'karmolab-youtube-backup',version:1,settings:{commentTranslate:false},blocks:[]},{local:area(localValues),sync:area({})});
  assert.equal(localValues.commentDensity,'compact');assert.equal(localValues.homeDensity,'small');assert.equal(localValues.commentTranslate,false);
  assert.equal(localValues.commentFontSize,18);assert.equal(localValues.commentLineHeight,26);assert.equal(localValues.homeCardWidth,220);
});
