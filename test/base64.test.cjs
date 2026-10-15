const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decodeUrl, findLinks } = require(process.env.BASE64_CORE_SOURCE || '../features/base64-core.js');
const encode = text => Buffer.from(text).toString('base64');

test('Base64 URL: standard, unpadded, URL-safe, Unicode and multiple tokens', () => {
  for (const url of ['https://example.com/path?q=한글#part', 'http://example.org/', 'https://example.com/~~~?a=??']) {
    const base64 = encode(url);
    for (const token of [base64, base64.replace(/=+$/, ''), Buffer.from(url).toString('base64url')]) {
      assert.equal(decodeUrl(token)?.href, new URL(url).href);
    }
  }
  const a = encode('https://example.com/a'), b = encode('https://example.org/b');
  assert.deepEqual(findLinks(`주소 (${a}), 다음: ${b}.`).map(x => x.hostname), ['example.com', 'example.org']);
});
test('Base64 URL rejects scripts, embedded URLs, credentials, controls and malformed encoding', () => {
  for (const text of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'prefix https://example.com/', 'https://a:b@example.com/', 'https://example.com/\n', 'https://example.com/\u202Etxt', 'https:\\example.com', 'not a link']) {
    assert.equal(decodeUrl(encode(text)), null, text);
  }
  for (const token of ['a'.repeat(8193), 'aHR0cHM6Ly9leGFtcGxlLmNvbS8===', 'aHR0cHM6Ly9leGFtcGxlLmNvbS9', 'aHR0cHM6Ly9leGFtcGxlLmNvbS8=bad']) assert.equal(decodeUrl(token), null);
  assert.equal(findLinks('aHR0cHM6Ly9leGFtcGxlLmNvbS8===').length, 0);
});
