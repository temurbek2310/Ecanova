import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShowcaseCardItems,
  computeBackgroundParallaxOffset,
  computeScrollDistortionBoost,
  computeShowcaseCardTiltDeg,
  computeWebGLCameraZ,
  DEFAULT_WEBGL_BASE_Z,
  DEFAULT_WEBGL_MIN_Z,
  stepViscousBackgroundScroll,
  stepWebGLScrollState,
  type ViscousBackgroundScrollState,
  type WebGLScrollState,
} from './scroll-sync';
import type { CourseCatalogItem } from '../shared/types';

test('computeWebGLCameraZ maps scrollY monotonically from baseZ down to minZ', () => {
  const topZ = computeWebGLCameraZ({ scrollY: 0, maxScroll: 2000 });
  const midZ = computeWebGLCameraZ({ scrollY: 1000, maxScroll: 2000 });
  const bottomZ = computeWebGLCameraZ({ scrollY: 2000, maxScroll: 2000 });
  const clampedOverZ = computeWebGLCameraZ({ scrollY: 9999, maxScroll: 2000 });

  assert.equal(topZ, DEFAULT_WEBGL_BASE_Z);
  assert.ok(midZ < topZ && midZ > bottomZ, 'midpoint camera Z should interpolate cleanly');
  assert.equal(bottomZ, DEFAULT_WEBGL_MIN_Z);
  assert.equal(clampedOverZ, DEFAULT_WEBGL_MIN_Z);
});

test('computeScrollDistortionBoost stays passive at rest and scales with fast scroll velocity', () => {
  const idle = computeScrollDistortionBoost(0);
  assert.equal(idle.distortionBoost, 0);
  assert.equal(idle.timeSpeedMultiplier, 1.0);

  const slow = computeScrollDistortionBoost(6);
  const fast = computeScrollDistortionBoost(30);

  assert.ok(slow.distortionBoost > 0 && slow.distortionBoost < fast.distortionBoost);
  assert.ok(fast.timeSpeedMultiplier > slow.timeSpeedMultiplier);
  assert.ok(fast.timeSpeedMultiplier <= 5.2);
});

test('stepWebGLScrollState accelerates on fast scroll and interpolates back to passive idle when stopped', () => {
  let state: WebGLScrollState = {
    cameraZ: DEFAULT_WEBGL_BASE_Z,
    scrollY: 0,
    scrollBoost: 0,
    timeSpeedMultiplier: 1.0,
    accumulatedTime: 0,
  };

  for (let i = 1; i <= 15; i += 1) {
    state = stepWebGLScrollState(
      state,
      { scrollY: i * 90, maxScroll: 2000, velocity: 28 },
      0.016
    );
  }

  assert.ok(state.cameraZ < DEFAULT_WEBGL_BASE_Z, 'camera Z should move forward on scroll');
  assert.ok(state.scrollBoost > 0.5, 'fast scrolling should boost fluid distortion');
  assert.ok(state.timeSpeedMultiplier > 2.0, 'fast scrolling should accelerate shader time');
  const activeTimeAfterBurst = state.accumulatedTime;
  assert.ok(activeTimeAfterBurst > 15 * 0.016, 'accumulatedTime advances faster than passive 1x');

  for (let i = 0; i < 120; i += 1) {
    state = stepWebGLScrollState(
      state,
      { scrollY: 1350, maxScroll: 2000, velocity: 0 },
      0.032
    );
  }

  assert.equal(state.scrollBoost, 0, 'distortion returns smoothly to 0 when stopped');
  assert.equal(state.timeSpeedMultiplier, 1.0, 'time multiplier returns to passive 1.0x');
});

test('computeShowcaseCardTiltDeg tilts staggered around -2deg when scrolling and snaps to 0deg when idle', () => {
  assert.equal(computeShowcaseCardTiltDeg({ velocity: 0, cardIndex: 0 }), 0);
  assert.equal(computeShowcaseCardTiltDeg({ velocity: 10, cardIndex: 2 }), 0);

  const forward0 = computeShowcaseCardTiltDeg({ velocity: 900, cardIndex: 0 });
  const forward1 = computeShowcaseCardTiltDeg({ velocity: 900, cardIndex: 1 });
  const forward2 = computeShowcaseCardTiltDeg({ velocity: 900, cardIndex: 2 });

  assert.ok(forward0 < 0 && forward1 < 0 && forward2 < 0, 'forward scroll produces negative tilt');
  assert.notEqual(forward0, forward1, 'staggered tilt varies across adjacent cards');
  assert.notEqual(forward1, forward2, 'staggered tilt varies across card indices');

  const reverse0 = computeShowcaseCardTiltDeg({ velocity: -900, cardIndex: 0 });
  assert.ok(reverse0 > 0, 'reverse scroll tilts positively');
});

test('buildShowcaseCardItems generates 6 horizontal showcase cards from 3 courses with spotlight lessons', () => {
  const makeEdition = (id: string, title: string, lessonTitles: string[]) => ({
    id,
    courseId: id,
    locale: 'en' as const,
    version: 1,
    title,
    subtitle: `${title} sub`,
    description: `${title} desc`,
    outcomes: ['Outcome 1', 'Outcome 2'],
    prerequisites: [],
    completionRules: 'All',
    passingScorePercent: 80,
    status: 'published' as const,
    subjectReviewerId: null,
    languageReviewerId: null,
    rightsReviewerId: null,
    publishedAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    lessonCount: lessonTitles.length,
    lessonTitles,
    estimatedMinutes: 45,
    provenance: null,
  });

  const sampleCourses: CourseCatalogItem[] = [
    {
      id: 'c1',
      slug: 'econ-101',
      subject: 'Economics',
      level: 'Beginner',
      estimatedMinutes: 45,
      editions: { en: makeEdition('c1', 'Micro', ['Demand', 'Elasticity']), uz: null },
    },
    {
      id: 'c2',
      slug: 'math-101',
      subject: 'Mathematics',
      level: 'Intermediate',
      estimatedMinutes: 60,
      editions: { en: makeEdition('c2', 'Calculus', ['Limits', 'Derivatives']), uz: null },
    },
    {
      id: 'c3',
      slug: 'biz-101',
      subject: 'Business',
      level: 'Advanced',
      estimatedMinutes: 75,
      editions: { en: makeEdition('c3', 'Unit Econ', ['Margin', 'LTV/CAC']), uz: null },
    },
  ];

  const cards = buildShowcaseCardItems(
    sampleCourses,
    'en',
    { Economics: 'Economics', Mathematics: 'Mathematics', Business: 'Business' },
    { Beginner: 'Beginner', Intermediate: 'Intermediate', Advanced: 'Advanced' }
  );

  assert.equal(cards.length, 6);
  assert.equal(cards[3]?.isModuleSpotlight, true);
  assert.equal(cards[3]?.lessonIndex, 1);
  assert.equal(cards[3]?.title, 'Elasticity');
});

test('computeBackgroundParallaxOffset maps pointer [-1,1] to opposite ±25px range cleanly', () => {
  const topLeft = computeBackgroundParallaxOffset({
    clientX: 0,
    clientY: 0,
    viewportWidth: 1440,
    viewportHeight: 900,
    maxOffsetPx: 25,
  });
  assert.equal(topLeft.normalizedX, -1);
  assert.equal(topLeft.normalizedY, -1);
  assert.equal(topLeft.x, 25);
  assert.equal(topLeft.y, 25);

  const center = computeBackgroundParallaxOffset({
    clientX: 720,
    clientY: 450,
    viewportWidth: 1440,
    viewportHeight: 900,
    maxOffsetPx: 25,
  });
  assert.equal(center.x, 0);
  assert.equal(center.y, 0);

  const bottomRightClamped = computeBackgroundParallaxOffset({
    clientX: 2000,
    clientY: 1200,
    viewportWidth: 1440,
    viewportHeight: 900,
    maxOffsetPx: 25,
  });
  assert.equal(bottomRightClamped.x, -25);
  assert.equal(bottomRightClamped.y, -25);
});

test('stepViscousBackgroundScroll damps scroll jumps heavily without velocity spikes', () => {
  let state: ViscousBackgroundScrollState = {
    scrollY: 0,
    scrollProgress: 0,
    velocitySmooth: 0,
    cameraZ: DEFAULT_WEBGL_BASE_Z,
    accumulatedTime: 0,
  };

  // Simulate sudden large jump to 1500px scrubbed by ScrollTrigger
  state = stepViscousBackgroundScroll(
    state,
    { scrubbedProgress: 0.75, scrubbedScrollY: 1500, maxScroll: 2000 },
    0.016
  );

  // Heavy viscous damping moves only a fraction per frame and constrains velocity <= 0.32
  assert.ok(state.scrollY > 0 && state.scrollY < 150);
  assert.ok(state.velocitySmooth <= 0.32);

  for (let i = 0; i < 200; i += 1) {
    state = stepViscousBackgroundScroll(
      state,
      { scrubbedProgress: 0.75, scrubbedScrollY: 1500, maxScroll: 2000 },
      0.032
    );
  }
  assert.ok(Math.abs(state.scrollY - 1500) < 1);
  assert.equal(state.velocitySmooth, 0);
});
