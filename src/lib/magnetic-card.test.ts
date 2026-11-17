import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMagneticBoxShadow,
  computeMagneticCardTransform,
  DEFAULT_MAGNETIC_HOVER_SCALE,
  DEFAULT_MAGNETIC_MAX_TRANSLATE_PX,
  getRestingMagneticCardState,
  RESTING_BRUTAL_BOX_SHADOW,
} from './magnetic-card.ts';

test('getRestingMagneticCardState returns neutral scale=1, zero offset, and resting Neobrutalist shadow', () => {
  const resting = getRestingMagneticCardState();
  assert.equal(resting.isHovered, false);
  assert.equal(resting.x, 0);
  assert.equal(resting.y, 0);
  assert.equal(resting.scale, 1);
  assert.equal(resting.boxShadow, RESTING_BRUTAL_BOX_SHADOW);
});

test('computeMagneticCardTransform calculates subtle magnetic pull, scale-up, and pronounced shadow on cursor move', () => {
  const rect = { left: 100, top: 200, width: 400, height: 300 };

  // Cursor at exact center of the card -> x: 0, y: 0, scale: 1.018
  const center = computeMagneticCardTransform({
    clientX: 300,
    clientY: 350,
    rect,
  });
  assert.equal(center.isHovered, true);
  assert.equal(center.x, 0);
  assert.equal(center.y, 0);
  assert.equal(center.scale, DEFAULT_MAGNETIC_HOVER_SCALE);
  assert.ok(center.boxShadow.includes('13px 13px 0px rgb(var(--theme-shadow-rgb))'));

  // Cursor at bottom-right corner -> x: +6, y: +6
  const bottomRight = computeMagneticCardTransform({
    clientX: 500,
    clientY: 500,
    rect,
  });
  assert.equal(bottomRight.x, DEFAULT_MAGNETIC_MAX_TRANSLATE_PX);
  assert.equal(bottomRight.y, DEFAULT_MAGNETIC_MAX_TRANSLATE_PX);
  assert.equal(bottomRight.normalizedX, 1);
  assert.equal(bottomRight.normalizedY, 1);

  // Cursor at top-left corner -> x: -6, y: -6
  const topLeft = computeMagneticCardTransform({
    clientX: 100,
    clientY: 200,
    rect,
  });
  assert.equal(topLeft.x, -DEFAULT_MAGNETIC_MAX_TRANSLATE_PX);
  assert.equal(topLeft.y, -DEFAULT_MAGNETIC_MAX_TRANSLATE_PX);
});

test('computeMagneticCardTransform clamps out-of-bounds coordinates and handles zero-size rects safely', () => {
  const clamped = computeMagneticCardTransform({
    clientX: 2000,
    clientY: -500,
    rect: { left: 0, top: 0, width: 200, height: 100 },
  });
  assert.equal(clamped.normalizedX, 1);
  assert.equal(clamped.normalizedY, -1);
  assert.equal(clamped.x, DEFAULT_MAGNETIC_MAX_TRANSLATE_PX);
  assert.equal(clamped.y, -DEFAULT_MAGNETIC_MAX_TRANSLATE_PX);

  const zeroRect = computeMagneticCardTransform({
    clientX: 50,
    clientY: 50,
    rect: { left: 0, top: 0, width: 0, height: 0 },
  });
  assert.equal(zeroRect.x, 0);
  assert.equal(zeroRect.y, 0);
  assert.equal(zeroRect.scale, DEFAULT_MAGNETIC_HOVER_SCALE);
  assert.equal(
    buildMagneticBoxShadow(false),
    '8px 8px 0px rgb(var(--theme-shadow-rgb))'
  );
});
