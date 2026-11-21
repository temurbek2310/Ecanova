import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTRANCE_DOM_END_S,
  ENTRANCE_SHAPES_MS,
  ENTRANCE_TIMELINE,
  createLandingEntrance,
  easeOutQuint,
  resolveIntroProgress,
} from './landing-entrance';

test('timeline follows the three-stage order: shapes, then navbar, then hero, ~2s total', () => {
  const t = ENTRANCE_TIMELINE;
  assert.ok(t.nav.at * 1000 < ENTRANCE_SHAPES_MS, 'navbar starts while shapes are settling');
  assert.ok(t.navItems.at >= t.nav.at);
  assert.ok(t.heroBadge.at >= t.nav.at + 0.3, 'hero follows the navbar');
  assert.ok(t.heroLines.at > t.heroBadge.at && t.heroRise.at > t.heroLines.at);
  assert.ok(ENTRANCE_DOM_END_S >= 1.8 && ENTRANCE_DOM_END_S <= 2.1, `total ${ENTRANCE_DOM_END_S}s`);
});

test('the shared clock starts once and notifies listeners once', () => {
  const entrance = createLandingEntrance();
  const seen: number[] = [];
  entrance.onStart.add((t) => seen.push(t));
  assert.equal(entrance.start(100), 100);
  assert.equal(entrance.start(500), 100, 'second start keeps the first timestamp');
  assert.deepEqual(seen, [100]);
});

test('intro progress: 0 before start, linear in between, clamped, 1 when skipped', () => {
  assert.equal(resolveIntroProgress(50, null, false), 0);
  assert.equal(resolveIntroProgress(50, null, true), 1);
  assert.equal(resolveIntroProgress(100 + ENTRANCE_SHAPES_MS / 2, 100, false), 0.5);
  assert.equal(resolveIntroProgress(1e9, 100, false), 1, 'a long-hidden tab resumes assembled');
  assert.equal(resolveIntroProgress(10, 100, false), 0);
});

test('easeOutQuint is monotonic, front-loaded and clamped', () => {
  assert.equal(easeOutQuint(0), 0);
  assert.equal(easeOutQuint(1), 1);
  assert.ok(easeOutQuint(0.5) > 0.9, 'calm settle: most travel happens early');
  assert.equal(easeOutQuint(2), 1);
  assert.equal(easeOutQuint(Number.NaN), 1);
});
