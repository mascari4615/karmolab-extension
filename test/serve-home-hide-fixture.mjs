import http from 'node:http';
import fs from 'node:fs/promises';
const base=new URL('../',import.meta.url);
const paths=new Map([
  ['/', ['test/home-hide-fixture.html','text/html; charset=utf-8']],
  ['/features/home-feedback-core.js',['features/home-feedback-core.js','text/javascript; charset=utf-8']],
  ['/features/home-hide.js',['features/home-hide.js','text/javascript; charset=utf-8']],
  ['/features/user-block.css',['features/user-block.css','text/css; charset=utf-8']],
  ['/_locales/ko/messages.json',['_locales/ko/messages.json','application/json; charset=utf-8']],
]);
const server=http.createServer(async(req,res)=>{
  const entry=paths.get(req.url);
  if(!entry){res.writeHead(404);res.end();return;}
  try{res.writeHead(200,{'Content-Type':entry[1]});res.end(await fs.readFile(new URL(entry[0],base)));}catch{res.writeHead(500);res.end();}
});
server.listen(0,'127.0.0.1',()=>console.log('Home fixture: http://127.0.0.1:'+server.address().port+'/'));
