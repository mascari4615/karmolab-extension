import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const argument = process.argv[2];
if (!argument) throw Error('Usage: node scripts/prepare-sync-probe.mjs <new-output-directory>');
const output = resolve(argument);
const extension = join(output, 'extension');
mkdirSync(output);
mkdirSync(extension);
const files = ['keyword-core.js', 'arca/block-store.js', 'keyword-background.mjs', 'density-core.js',
  'settings-backup.js', 'keyword-sync.mjs', 'sync-snapshot.mjs', 'block-sync.mjs'];
for (const file of files) {
  const target = join(extension, 'features', file);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(root, 'features', file), target);
}
const source = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const manifest = {
  manifest_version: 3,
  name: 'KarmoLab Sync Test',
  version: source.version,
  permissions: ['storage', 'alarms', 'nativeMessaging'],
  background: { service_worker: 'sync-probe-worker.mjs', type: 'module' }
};
manifest.key = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArWXhe20E9xfjkzELwnsY1a7STO8/Q/dLfkFLPWXtJta5azVcy6XFNKLOKb39x6W7FL7jEdew5bxiBo8TkCA8q3UVDoLS71CH7gfYP4o22dyREq6sXOlVWjedHls8qzXZzGIR1LbZ+/2Fl2QpEsh+OUu/iLGNByqnSwbvGEBwMXXgokKRG/4wWlMoQun9B9YEvj/FUtUrCpSi0OocfFUMtfsb4DaW/Q6x1261CLq9YRIa+tKj7QCt7oIUmFcmhfRHDrU7EMxmC06TTS2iNY+siFHk9pzlHAcozGGDuvFlRysSTU7bcM6+kh4v3uWk24iKDp4Y7Xg/zJ4aIvGUvwzytwIDAQAB';
writeFileSync(join(extension, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
cpSync(join(root, 'dev/sync-probe/worker.mjs'), join(extension, 'sync-probe-worker.mjs'));
for (const file of ['Host.cs', 'install.ps1']) cpSync(join(root, 'dev/sync-probe', file), join(output, file));
console.log(dirname(extension));
