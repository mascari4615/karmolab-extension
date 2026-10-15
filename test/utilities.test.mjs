import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { volumeValue, siteInfo, volumeScriptId } from '../features/volume-core.mjs';
const { parse, match } = createRequire(import.meta.url)('../features/keyword-core.js');
test('keywords use literal, case-insensitive Unicode-normalized substring matching', () => {
  const words = parse('스포\n SPOILER \nspoiler\n\n[결말]\n');
  assert.deepEqual(words, ['스포','SPOILER','[결말]']);
  assert.equal(match('ＳＰＯＩＬＥＲ warning', words), 'SPOILER');
  assert.equal(match('이것은 스포일러', words), '스포');
  assert.equal(match('결말만 말함', words), null);
  assert.equal(match('정상 댓글', []), null);
  assert.equal(match('literal .* text', parse('.*')), '.*');
});
test('keyword limits reject oversized input rather than silently losing rules', () => {
  assert.throws(() => parse('가'.repeat(201)), /long/);
  assert.throws(() => parse(Array.from({length:201},(_,i)=>'word'+i).join('\n')), /many/);
  assert.equal(parse(Array(500).fill('같음').join('\n')).length, 1);
});
test('site volume accepts 0 through 300 and rejects invalid values', () => {
  for (const number of [0,50,100,150,200,300]) assert.equal(volumeValue(String(number)),number);
  for (const value of [-1,301,NaN,Infinity,'',null,true,{},'loud']) assert.throws(()=>volumeValue(value));
});
test('volume sites retain protocol and port; script registration uses permitted host patterns', () => {
  assert.deepEqual(siteInfo('https://example.com:8443/watch?a=1'),{origin:'https://example.com:8443',host:'example.com:8443',pattern:'https://example.com/*'});
  assert.notEqual(siteInfo('http://example.com/').origin,siteInfo('https://example.com/').origin);
  assert.notEqual(volumeScriptId('http://example.com/*'),volumeScriptId('https://example.com/*'));
  for(const url of ['edge://settings/','file:///C:/test','javascript:alert(1)','https://chromewebstore.google.com/'])assert.throws(()=>siteInfo(url));
});
