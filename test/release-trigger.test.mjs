import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const workflow = readFileSync(new URL('../.github/workflows/store-release.yml', import.meta.url), 'utf8');
const condition = workflow.match(/\n  submit:\s*\n\s+needs: package\s*\n\s+if: ([^\n]+)/)?.[1];
if (!condition) throw new Error('Submission job condition not found');
const runs = (event, action = 'package', ref = 'refs/heads/main') => vm.runInNewContext(condition, {
  github: { event_name: event, ref }, inputs: { action }, needs: { package: { outputs: { release: 'true' } } },
});

test('source push with a new runtime version never submits to stores', () => {
  assert.equal(runs('push'), false);
  assert.equal(runs('pull_request'), false);
});
test('only explicit manual submit or status runs the store job on main', () => {
  assert.equal(runs('workflow_dispatch', 'package'), false);
  assert.equal(runs('workflow_dispatch', 'submit'), true);
  assert.equal(runs('workflow_dispatch', 'status'), true);
  assert.equal(runs('workflow_dispatch', 'submit', 'refs/heads/preview'), false);
});
