// Run after npm pack darkreader@4.9.134 --ignore-scripts --pack-destination dist and tar extraction.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const integrity = 'HAyEz97vK/UFLO6kcjxojji5OKr0+pwgGLrBzyg67xD2p6ySrSyCBvNxb+0KTSMYk9qNz9Hq85JR3TaKyqEV1w==';
const archive = readFileSync('dist/darkreader-4.9.134.tgz');
if (createHash('sha512').update(archive).digest('base64') !== integrity) throw new Error('Vendor archive integrity mismatch');
const source = readFileSync('dist/package/darkreader.js', 'utf8');
// Isolate the upstream runtime shim from the extension messaging API.
writeFileSync('features/vendor/darkreader.js', `/* Dark Reader 4.9.134, MIT. See DARKREADER-LICENSE. */\n(function(chrome) {\n${source}\n})({});\n`);
writeFileSync('features/vendor/DARKREADER-LICENSE', readFileSync('dist/package/LICENSE'));
