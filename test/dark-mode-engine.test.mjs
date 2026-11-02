import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../features/dark-mode-engine.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const engine = context.KarmoDarkEngine;
function converted(value) {
  const parts = value.match(/[\d.]+/g).map(Number);
  const [h, s, l] = [parts[0] / 360, parts[1] / 100, parts[2] / 100];
  const channel = n => {
    const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [channel(0), channel(8), channel(4)];
}
test('external-stylesheet black text and white panels retain readable contrast', () => {
  for (const background of ['rgb(255, 255, 255)', 'rgb(245, 245, 245)', 'rgb(220, 230, 250)']) {
    for (const text of ['rgb(0, 0, 0)', 'rgb(51, 51, 51)', 'rgb(102, 102, 102)', 'rgb(0, 0, 180)', 'rgb(180, 21, 0)']) {
      const bg = engine.luminance(converted(engine.mapColor(background, 'background')));
      const fg = engine.luminance(converted(engine.mapColor(text, 'text')));
      assert.ok((fg + .05) / (bg + .05) >= 4.5, `${background} / ${text}`);
    }
  }
});
test('transparency, existing dark panels, bright text and unsupported color values are preserved', () => {
  assert.equal(engine.mapColor('rgba(0, 0, 0, 0)', 'background'), null);
  assert.equal(engine.mapColor('rgb(24, 26, 27)', 'background'), null);
  assert.equal(engine.mapColor('rgb(240, 240, 240)', 'text'), null);
  assert.equal(engine.mapColor('transparent', 'background'), null);
  assert.equal(engine.mapColor('url(image.png)', 'background'), null);
  assert.match(engine.mapColor('rgba(255, 255, 255, 0.4)', 'background'), /,0\.4\)$/);
});
test('hue distinguishes warning red and link blue rather than flattening every color', () => {
  const red = converted(engine.mapColor('rgb(180, 21, 0)', 'text'));
  const blue = converted(engine.mapColor('rgb(0, 30, 180)', 'text'));
  assert.ok(red[0] > red[1] && red[0] > red[2]);
  assert.ok(blue[2] > blue[0] && blue[2] > blue[1]);
});
