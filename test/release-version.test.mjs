import test from 'node:test';
import assert from 'node:assert/strict';
import { versionParts, isNewer } from '../scripts/prepare-release.mjs';

test('version ordering uses numeric components', () => {
  assert.equal(isNewer('0.1.10', '0.1.9'), true);
  assert.equal(isNewer('0.1.1', '0.1.1'), false);
  assert.equal(isNewer('0.1.1.0', '0.1.1'), false);
  assert.equal(isNewer('0.1.0', '0.1.1'), false);
});
test('invalid extension versions fail before packaging', () => {
  for (const version of ['0.0.0', '01.2.3', '1.65536', '1.2.3.4.5', '1.2.beta']) assert.throws(() => versionParts(version));
});
