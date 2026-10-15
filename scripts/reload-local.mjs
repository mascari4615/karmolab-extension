import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { buildDigest } from '../dev/build.mjs';

export async function diskBuild(root) {
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  return buildDigest(manifest, file => readFile(resolve(root, file)), bytes => createHash('sha256').update(bytes).digest('hex'));
}

export async function reloadLocal({ root, id, port = 17379, timeoutMs = 65000, ready = () => {} }) {
  if (!/^[a-p]{32}$/.test(id)) throw new Error('Explicit extension ID required');
  const expected = await diskBuild(root);
  const nonce = randomUUID();
  let before;
  let last;
  let timer;
  let boundPort = port;
  let finish;
  const result = new Promise((resolveResult, reject) => { finish = { resolve: resolveResult, reject }; });
  const server = createServer((request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${boundPort}`);
    const origin = `chrome-extension://${id}`;
    if (request.method !== 'GET' || url.pathname !== '/karmolab/reload' || url.searchParams.get('id') !== id || request.headers['x-karmolab-reload'] !== '1' || (request.headers.origin && request.headers.origin !== origin) || request.headers.host !== `127.0.0.1:${boundPort}`) {
      response.writeHead(403).end(); return;
    }
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    const info = Object.fromEntries(url.searchParams);
    last = info;
    if (!before) before = info;
    if (info.boot !== before.boot && info.build === expected && info.completed === nonce) {
      response.end('{}');
      finish.resolve({ id, build: expected, beforeBoot: before.boot, afterBoot: info.boot, youtubeRefreshed: true });
    } else if (info.boot === before.boot) response.end(JSON.stringify({ action: 'reload', nonce }));
    else response.end('{}');
  });
  try {
    await new Promise((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolveListen);
    });
    boundPort = server.address().port;
    await ready(boundPort);
    timer = setTimeout(() => finish.reject(new Error(before ? `Reload not confirmed: ${JSON.stringify({ expected, before, last })}` : 'No KarmoLab receiver response; bootstrap reload not confirmed')), timeoutMs);
    return await result;
  } finally {
    clearTimeout(timer);
    server.closeAllConnections();
    await new Promise(resolveClose => server.close(resolveClose));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { id: { type: 'string', default: 'jblnjmafdicfkgfghgcgijkconpomgkc' }, root: { type: 'string' } } });
  const root = values.root || fileURLToPath(new URL('../', import.meta.url));
  try { console.log(JSON.stringify(await reloadLocal({ root, id: values.id, ready: () => console.log('Waiting for KarmoLab local receiver (up to 65s)') }))); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
