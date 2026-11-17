import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKineticHeroConfig,
  interpolateKineticLineTransform,
} from './kinetic-hero';

test('buildKineticHeroConfig generates tactile academic kinetic lines for EN and UZ', () => {
  const enConfig = buildKineticHeroConfig('en', false);
  assert.equal(enConfig.lines.length, 2);
  assert.equal(enConfig.lines[0]?.primaryText, 'STRUCTURED');
  assert.equal(enConfig.lines[0]?.accentText, 'MASTERY.');
  assert.ok(enConfig.lines[0]!.scrollTranslateXPercent < 0);
  assert.ok(enConfig.lines[1]!.scrollTranslateXPercent > 0);
  assert.ok(enConfig.scrubFactor > 0);

  const uzConfig = buildKineticHeroConfig('uz', false);
  assert.equal(uzConfig.lines[0]?.primaryText, 'TIZIMLI');
  assert.equal(uzConfig.lines[0]?.accentText, 'TAFAKKUR.');
});

test('buildKineticHeroConfig neutralizes scroll motion when prefersReducedMotion is true', () => {
  const reduced = buildKineticHeroConfig('en', true);
  assert.equal(reduced.scrubFactor, 0);
  for (const line of reduced.lines) {
    assert.equal(line.scrollTranslateXPercent, 0);
    assert.equal(line.scrollTranslateY, 0);
    assert.equal(line.scrollScale, 1);
  }
});

test('interpolateKineticLineTransform clamps scroll progress and computes scale + translation', () => {
  const config = buildKineticHeroConfig('en', false);
  const firstLine = config.lines[0]!;

  const atStart = interpolateKineticLineTransform(firstLine, 0);
  assert.deepEqual(atStart, { xPercent: 0, y: 0, scale: 1 });

  const atEnd = interpolateKineticLineTransform(firstLine, 1);
  assert.equal(atEnd.xPercent, firstLine.scrollTranslateXPercent);
  assert.equal(atEnd.y, firstLine.scrollTranslateY);
  assert.equal(atEnd.scale, firstLine.scrollScale);

  const overClamped = interpolateKineticLineTransform(firstLine, 5);
  assert.deepEqual(overClamped, atEnd);
});
