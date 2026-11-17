import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMathematicsChalkBlueprints,
  computeChalkStrokeDrawState,
  resolveMathGrainOverlayProps,
} from './mathematics-chalk';

test('computeChalkStrokeDrawState calculates stroke-dasharray and stroke-dashoffset for DrawSVG animation', () => {
  const hidden = computeChalkStrokeDrawState(240, 0);
  assert.equal(hidden.strokeDasharray, '240.00 240.00');
  assert.equal(hidden.strokeDashoffset, 240);

  const half = computeChalkStrokeDrawState(240, 0.5);
  assert.equal(half.strokeDashoffset, 120);

  const drawn = computeChalkStrokeDrawState(240, 1);
  assert.equal(drawn.strokeDashoffset, 0);
});

test('resolveMathGrainOverlayProps toggles mix-blend-screen in dark mode and mix-blend-multiply in light mode', () => {
  const darkOverlay = resolveMathGrainOverlayProps('dark');
  assert.equal(darkOverlay.mixBlendClass, 'mix-blend-screen');
  assert.equal(darkOverlay.blendMode, 'screen');

  const lightOverlay = resolveMathGrainOverlayProps('light');
  assert.equal(lightOverlay.mixBlendClass, 'mix-blend-multiply');
  assert.equal(lightOverlay.blendMode, 'multiply');
});

test('buildMathematicsChalkBlueprints returns 3 chalkboard diagrams with dynamic theme SVG strokes in EN and UZ', () => {
  const en = buildMathematicsChalkBlueprints('en');
  assert.equal(en.length, 3);
  assert.equal(en[0]?.id, 'derivative-tangent');
  assert.ok(en[0]!.strokes.length >= 4);
  for (const bp of en) {
    assert.ok(bp.formulaLatex.length > 0);
    for (const s of bp.strokes) {
      assert.ok(s.d.startsWith('M '));
      assert.ok(s.fallbackLength > 0);
      assert.ok(s.color.startsWith('var(--econova-'));
      assert.ok(s.strokeClassName.includes('stroke-current'));
    }
  }

  const uz = buildMathematicsChalkBlueprints('uz');
  assert.equal(uz.length, 3);
  assert.ok(uz[0]?.title.includes('Hosilaning'));
});
