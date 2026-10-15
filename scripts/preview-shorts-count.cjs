const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { shorts } = require('./verify-shorts-count.cjs');
const root = path.resolve(__dirname, '..');
const messages = JSON.parse(fs.readFileSync(path.join(root, '_locales/ko/messages.json'), 'utf8'));
const setup = `<style>.demo-controls{position:absolute;right:24px;top:110px;max-width:260px;padding:18px;color:#eee;background:#202020;font:14px/1.7 system-ui}.demo-controls p{margin:0 0 12px}.demo-controls button,.demo-controls select{margin:4px 0;padding:8px;background:#292929;border:1px solid #777;border-radius:4px;color:#eee;font:inherit}.demo-controls label{display:block}@media(max-width:1050px){.demo-controls{position:relative;top:auto;right:auto;margin:760px 24px 24px;max-width:none}}</style>
<aside class="demo-controls"><p>미리보기입니다. 2초 재생 뒤 날짜 아래 숫자를 확인하세요.</p><label for="mode">표시할 집계</label><select id="mode"><option value="both">영상 수와 재시청 포함 횟수</option><option value="unique">영상 수</option><option value="views">재시청 포함 횟수</option></select><div><button id="next">다음 쇼츠</button> <button id="previous">이전 쇼츠</button></div><p>같은 영상으로 돌아오면 횟수만 늘어납니다. 자동 반복은 제외합니다.</p></aside>
<script>
const listeners=[],values=JSON.parse(sessionStorage.getItem('shorts-demo')||'{}'),messages=${JSON.stringify(messages)};
window.chrome={i18n:{getMessage:(key,args)=>messages[key].message.replace(/\\$([A-Z]+)\\$/g,(_,p)=>{const i=Number(messages[key].placeholders[p.toLowerCase()].content.slice(1))-1;return Array.isArray(args)?args[i]:args})},storage:{sync:{get:(defaults,cb)=>cb(defaults)},local:{get:async()=>({...values}),set:async update=>{Object.assign(values,update);sessionStorage.setItem('shorts-demo',JSON.stringify(values));listeners.forEach(fn=>fn(Object.fromEntries(Object.entries(update).map(([key,newValue])=>[key,{newValue}])),'local'))},remove:async keys=>{keys.forEach(key=>delete values[key]);sessionStorage.setItem('shorts-demo',JSON.stringify(values));listeners.forEach(fn=>fn(Object.fromEntries(keys.map(key=>[key,{}])),'local'))}},onChanged:{addListener:fn=>listeners.push(fn)}}};
document.querySelector('#mode').value=values.shortsCountMode||'both';document.querySelector('#mode').onchange=event=>chrome.storage.local.set({shortsCountMode:event.target.value});
function navigate(id){history.pushState({},'', '/shorts/'+id);document.querySelector('#self').href='/shorts/'+id;document.querySelector('#self').textContent=id==='abcdefghijk'?'시험 영상 1':'시험 영상 2'}
document.querySelector('#next').onclick=()=>navigate('lmnopqrstuv');document.querySelector('#previous').onclick=()=>navigate('abcdefghijk');
</script><link rel="stylesheet" href="/features/shorts-date.css"><script src="/features/shorts-count.js"></script><script src="/features/shorts-date.js"></script>`;
const html = shorts.replace('<script>', setup + '<script>');
const files = new Set(['/features/shorts-count.js', '/features/shorts-date.js', '/features/shorts-date.css']);
http.createServer((request, response) => {
  if (request.url.startsWith('/youtubei/') && request.method === 'POST') { response.setHeader('Content-Type', 'application/json'); return response.end(JSON.stringify({ microformat: { playerMicroformatRenderer: { publishDate: '2026-10-01' } } })); }
  if (files.has(request.url)) { response.setHeader('Content-Type', request.url.endsWith('.css') ? 'text/css' : 'application/javascript'); return response.end(fs.readFileSync(path.join(root, request.url))); }
  response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
}).listen(0, '127.0.0.1', function () { console.log(`http://127.0.0.1:${this.address().port}/shorts/abcdefghijk`); });
