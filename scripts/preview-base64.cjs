const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const token = Buffer.from('https://example.com/hello').toString('base64');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KarmoLab Base64 링크 미리보기</title>
<link rel="stylesheet" href="/features/base64-links.css"><style>
:root{color-scheme:light dark}body{max-width:720px;margin:40px auto;padding:0 24px;font:16px/1.8 system-ui;overflow-wrap:anywhere}h1{font-size:26px;line-height:1.4}h2{font-size:18px;margin-top:32px}p{margin:16px 0}button{font:inherit;padding:8px 14px;border:1px solid currentColor;border-radius:4px;cursor:pointer}textarea{box-sizing:border-box;width:100%;height:90px;font:14px/1.6 system-ui;padding:12px}small{display:block;margin:12px 0}button:focus-visible{outline:2px solid currentColor;outline-offset:3px}
</style><h1>Base64 주소를 바로 링크로</h1><p>원문은 그대로, 옆에는 목적지가 보이는 링크.</p><small>미리보기입니다. 실제 사이트 적용은 확장 팝업에서 켭니다.</small>
<button id="toggle" type="button" aria-pressed="true">링크 표시 끄기</button> <button id="add" type="button">새 댓글 추가</button>
<h2>본문</h2><p>${token}</p><div id="comments"></div><h2>직접 붙여 보기</h2><p>Base64 주소를 붙인 뒤 아래 버튼을 누르면 본문으로 추가됩니다.</p><textarea id="input" aria-label="Base64 주소 입력">${token}</textarea><button id="submit" type="button">본문에 추가</button><div id="custom"></div>
<script>
const listeners=[];let on=true;const site=location.protocol+'//'+location.hostname+'/*';
window.chrome={i18n:{getMessage:(_key,domain)=>domain+' 열기'},storage:{local:{get:async()=>({base64Sites:on?[site]:[]})},onChanged:{addListener:fn=>listeners.push(fn)}}};
document.querySelector('#toggle').onclick=()=>{on=!on;listeners.forEach(fn=>fn({base64Sites:{newValue:on?[site]:[]}},'local'));document.querySelector('#toggle').textContent=on?'링크 표시 끄기':'링크 표시 켜기';document.querySelector('#toggle').setAttribute('aria-pressed',String(on))};
function add(selector,text){const p=document.createElement('p');p.textContent=text;document.querySelector(selector).append(p)}
document.querySelector('#add').onclick=()=>add('#comments','새 댓글: '+${JSON.stringify(token)});
document.querySelector('#submit').onclick=()=>add('#custom',document.querySelector('#input').value);
</script><script src="/features/base64-core.js"></script><script src="/features/base64-links.js"></script></html>`;
const assets = new Set(['/features/base64-core.js', '/features/base64-links.js', '/features/base64-links.css']);
const server = http.createServer((request, response) => {
  if (request.url === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); return response.end(html); }
  if (!assets.has(request.url)) { response.statusCode = 404; return response.end(); }
  response.setHeader('Content-Type', request.url.endsWith('.css') ? 'text/css' : 'application/javascript');
  response.end(fs.readFileSync(path.join(root, request.url)));
});
server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/`));
