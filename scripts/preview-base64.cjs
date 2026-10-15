const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const token = Buffer.from('https://example.com/hello').toString('base64');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KarmoLab Base64 링크 미리보기</title>
<link rel="stylesheet" href="/features/base64-links.css"><style>
:root{color-scheme:light dark;--page:#fafaf9;--ink:#252522;--muted:#686862;--line:#deded8;--field:#fff}body{max-width:660px;margin:72px auto;padding:0 24px 48px;background:var(--page);color:var(--ink);font:16px/1.8 system-ui;overflow-wrap:anywhere}h1{font-size:28px;font-weight:600;letter-spacing:-.025em;line-height:1.4;margin:0 0 14px}h2{font-size:15px;font-weight:600;margin:32px 0 12px}p{margin:12px 0}button{font:500 13px/1.5 system-ui;padding:8px 12px;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:6px;cursor:pointer}button:hover{background:var(--line)}textarea{box-sizing:border-box;width:100%;height:88px;font:13px/1.7 ui-monospace,monospace;padding:12px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:6px;resize:vertical}small{display:block;margin:12px 0;color:var(--muted);font-size:13px}button:focus-visible,textarea:focus-visible{outline:2px solid currentColor;outline-offset:3px}.sample{padding:18px 0 24px;border-block:1px solid var(--line);margin:32px 0 18px}.controls{display:flex;gap:8px;flex-wrap:wrap}.intro{color:var(--muted)}@media(prefers-color-scheme:dark){:root{--page:#181818;--ink:#e6e6e1;--muted:#abab9f;--line:#3b3b36;--field:#20201f}}@media(max-width:480px){body{margin-top:32px}h1{font-size:24px}}
</style><h1>Base64 링크 미리보기</h1><p class="intro">문장에는 목적지만. 원문은 옆의 화살표로 펼쳐 보세요.</p>
<div class="sample"><p>참고 자료는 ${token} 에 정리해뒀어요.</p><div id="comments"></div></div>
<div class="controls"><button id="toggle" type="button" aria-pressed="true">링크 표시 끄기</button><button id="add" type="button">새 댓글 추가</button></div>
<h2>직접 붙여 보기</h2><textarea id="input" aria-label="Base64 주소 입력">${token}</textarea><button id="submit" type="button">본문에 추가</button><div id="custom"></div><small>미리보기입니다. 실제 사이트 적용은 확장 팝업에서 켭니다.</small>
<script>
const listeners=[];let on=true;const site=location.protocol+'//'+location.hostname+'/*';
window.chrome={i18n:{getMessage:(key,domain)=>({base64ShowOriginal:'Base64 원문 보기',base64HideOriginal:'Base64 원문 접기'}[key]||domain+' 열기')},storage:{local:{get:async()=>({base64Sites:on?[site]:[]})},onChanged:{addListener:fn=>listeners.push(fn)}}};
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
server.listen(Number(process.env.PREVIEW_PORT) || 0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/`));
