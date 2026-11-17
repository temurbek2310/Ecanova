import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBusinessBentoModules,
  BUSINESS_RESIZE_DEBOUNCE_MS,
  computeBoundedPinTravelPx,
  computeBusinessCardStackTransform,
  shouldRefreshBusinessLayoutOnResize,
} from './business-bento';

test('buildBusinessBentoModules returns 4 asymmetrical bento modules in EN and UZ', () => {
  const en = buildBusinessBentoModules('en');
  assert.equal(en.length, 4);
  assert.equal(en[0]?.gridSpanClass, 'lg:col-span-7');
  assert.equal(en[1]?.gridSpanClass, 'lg:col-span-5');
  assert.equal(en[2]?.gridSpanClass, 'lg:col-span-5');
  assert.equal(en[3]?.gridSpanClass, 'lg:col-span-7');

  // Ensure initial vertical offsets stay tightly bounded inside the container stage
  for (const mod of en) {
    assert.ok(mod.initialTranslateYPx >= 0 && mod.initialTranslateYPx <= 16);
  }

  const uz = buildBusinessBentoModules('uz');
  assert.equal(uz.length, 4);
  assert.ok(uz[0]?.title.includes('Unit-iqtisodiyot'));
});

test('computeBusinessCardStackTransform stacks cards progressively onto their target offset', () => {
  const modules = buildBusinessBentoModules('en');
  const first = modules[0]!;
  const second = modules[1]!;
  const fourth = modules[3]!;

  const startSecond = computeBusinessCardStackTransform(second, 0, 4);
  assert.equal(startSecond.y, second.initialTranslateYPx);
  assert.ok(startSecond.zIndex > computeBusinessCardStackTransform(first, 0, 4).zIndex);

  const endSecond = computeBusinessCardStackTransform(second, 1, 4);
  assert.equal(endSecond.y, second.stackOffsetPx);

  const endFourth = computeBusinessCardStackTransform(fourth, 1, 4);
  assert.equal(endFourth.y, fourth.stackOffsetPx);
  assert.equal(endFourth.zIndex, 40);
});

test('computeBoundedPinTravelPx never allows pinned stage to exceed track bounds', () => {
  assert.equal(computeBoundedPinTravelPx(700, 440, 16), 244);
  assert.equal(computeBoundedPinTravelPx(440, 460, 16), 0);
  assert.equal(computeBoundedPinTravelPx(NaN, 440, 16), 0);
});

test('shouldRefreshBusinessLayoutOnResize filters invalid or unchanged dimensions', () => {
  assert.ok(BUSINESS_RESIZE_DEBOUNCE_MS >= 50 && BUSINESS_RESIZE_DEBOUNCE_MS <= 300);
  assert.equal(shouldRefreshBusinessLayoutOnResize(null, { width: 1440, height: 900 }), true);
  assert.equal(
    shouldRefreshBusinessLayoutOnResize({ width: 1440, height: 900 }, { width: 1440, height: 900 }),
    false
  );
  assert.equal(
    shouldRefreshBusinessLayoutOnResize({ width: 1440, height: 900 }, { width: 1440.4, height: 900.2 }),
    false
  );
  assert.equal(
    shouldRefreshBusinessLayoutOnResize({ width: 1440, height: 900 }, { width: 1024, height: 900 }),
    true
  );
  assert.equal(
    shouldRefreshBusinessLayoutOnResize({ width: 1440, height: 900 }, { width: 1440, height: 720 }),
    true
  );
  assert.equal(
    shouldRefreshBusinessLayoutOnResize({ width: 1440, height: 900 }, { width: 0, height: 900 }),
    false
  );
});
