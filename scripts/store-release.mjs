import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createStoreApi } from './store-api.mjs';

const { values } = parseArgs({ options: {
  store: { type: 'string' }, zip: { type: 'string' }, notes: { type: 'string' },
  receipt: { type: 'string' }, submit: { type: 'boolean', default: false }, status: { type: 'boolean', default: false },
  operation: { type: 'string' },
} });
async function main() {
  if (!['chrome', 'edge'].includes(values.store)) throw new Error('--store chrome|edge required');
  if (values.submit === values.status) throw new Error('Choose exactly one of --submit or --status');
  const store = values.store;
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  const file = resolve(values.receipt || `.release/${store}-${manifest.version}.json`);
  const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  const identity = store === 'edge' ? process.env.EDGE_PRODUCT_ID : `${process.env.CWS_PUBLISHER_ID}/${process.env.CWS_EXTENSION_ID}`;
  const api = createStoreApi();
  const provider = store === 'edge' ? api.edge(process.env) : await api.chrome(process.env);
  const save = value => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
  if (values.status) {
    if (previous && previous.identity !== identity) throw new Error('Receipt belongs to another store product');
    const result = store === 'chrome' ? await provider.read() : await provider.read(values.operation || previous?.publishOperationId ? 'publish' : 'upload', values.operation || previous?.publishOperationId || previous?.uploadOperationId);
    const output = store === 'chrome' ? { store, published: result.publishedItemRevisionStatus, submitted: result.submittedItemRevisionStatus, upload: result.lastAsyncUploadState } : { store, operationStatus: result.status, errorCode: result.errorCode, reviewStatus: 'CHECK_PARTNER_CENTER' };
    console.log(JSON.stringify(output)); return;
  }
  const zip = resolve(values.zip || `dist/karmolab-${manifest.version}.zip`);
  const bytes = readFileSync(zip);
  const tar = process.platform === 'win32' ? `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\tar.exe` : 'unzip';
  const packed = JSON.parse(execFileSync(tar, process.platform === 'win32' ? ['-xOf', zip, 'manifest.json'] : ['-p', zip, 'manifest.json'], { encoding: 'utf8' }));
  if (packed.version !== manifest.version) throw new Error('ZIP version differs from checkout');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const notes = readFileSync(values.notes || `release-notes/${manifest.version}.txt`, 'utf8').trim();
  if (!notes || notes.length >= 2000) throw new Error('Certification notes must contain 1..1999 characters');
  if (previous && (previous.sha256 !== sha256 || previous.identity !== identity || previous.version !== manifest.version)) throw new Error('Receipt does not match this package; use a separate version receipt');
  const receipt = previous || { store, identity, version: manifest.version, sha256 };
  save(receipt);
  try {
    const result = store === 'edge' ? await provider.submit(bytes, notes, receipt, save) : await provider.submit(bytes, manifest.version, receipt, save);
    console.log(JSON.stringify(result));
  } catch (error) {
    receipt.status = 'NEEDS_ATTENTION'; save(receipt); throw error;
  }
}
main().catch(error => { console.error(error.message); process.exitCode = /Missing configuration|still in progress/.test(error.message) ? 2 : 1; });
