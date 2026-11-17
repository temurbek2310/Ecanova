import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildArtifactConstellation,
  computeContainedArtifactCursorOffset,
  computeParticleMagneticGravity,
  getSubjectPhysicsProfile,
  shouldEnableComplexArtifactPhysics,
  SUBJECT_PHYSICS_PROFILES,
} from './artifact-physics';

test('SUBJECT_PHYSICS_PROFILES defines distinct easings and movement profiles per subject', () => {
  const math = getSubjectPhysicsProfile('Mathematics');
  assert.equal(math.profileName, 'structured-geometric');
  assert.equal(math.ease, 'power1.inOut');

  const econ = getSubjectPhysicsProfile('Economics');
  assert.equal(econ.profileName, 'market-flow');
  assert.equal(econ.ease, 'sine.inOut');

  const biz = getSubjectPhysicsProfile('Business');
  assert.equal(biz.profileName, 'strategic-tactical');
  assert.equal(biz.ease, 'expo.inOut');

  for (const profile of Object.values(SUBJECT_PHYSICS_PROFILES)) {
    for (const wp of profile.waypoints) {
      assert.ok(Math.hypot(wp.x, wp.y) <= profile.maxAnchorDriftRadiusPx);
    }
  }
});

test('buildArtifactConstellation creates 3-5 varied micro-particles with energetic 3-6s lifecycles', () => {
  const mathSwarm = buildArtifactConstellation({
    subject: 'Mathematics',
    seedIndex: 0,
    count: 4,
  });
  assert.equal(mathSwarm.length, 4);
  assert.ok(mathSwarm.every((p) => p.durationSec >= 3 && p.durationSec <= 6));
  assert.ok(mathSwarm.every((p) => p.baseScale >= 0.5 && p.baseScale <= 1.2));
  assert.ok(mathSwarm.every((p) => p.opacityClass === 'opacity-10' || p.opacityClass === 'opacity-15'));
  assert.ok(mathSwarm.some((p) => p.continuousSpin360));
  assert.ok(new Set(mathSwarm.map((p) => p.delaySec)).size >= 3);
  assert.deepEqual(mathSwarm[0].xRange, [-25, 25]);
  assert.deepEqual(mathSwarm[0].yRange, [-30, 30]);

  const bizSwarm = buildArtifactConstellation({
    subject: 'Business',
    seedIndex: 1,
    count: 5,
    preferredKind: 'chess-knight',
  });
  assert.equal(bizSwarm.length, 5);
  assert.equal(bizSwarm[0].kind, 'chess-knight');
  assert.ok(bizSwarm.every((p) => p.repeatDelaySec >= 0.4));
});

test('computeParticleMagneticGravity pulls swarm particles toward hovered cursor coordinates', () => {
  const rect = { left: 100, top: 100, width: 400, height: 300 };

  // Particle anchored in bottom-right (80%, 70%) pulled toward top-left cursor (120, 120)
  const pullTopLeft = computeParticleMagneticGravity({
    clientX: 120,
    clientY: 120,
    cardRect: rect,
    leftPercent: 80,
    topPercent: 70,
    gravityWeight: 1.1,
    maxPullPx: 28,
  });
  assert.ok(pullTopLeft.x < 0 && pullTopLeft.y < 0);

  // Particle anchored in top-left (20%, 20%) pulled toward bottom-right cursor (480, 380)
  const pullBottomRight = computeParticleMagneticGravity({
    clientX: 480,
    clientY: 380,
    cardRect: rect,
    leftPercent: 20,
    topPercent: 20,
    gravityWeight: 1.0,
    maxPullPx: 28,
  });
  assert.ok(pullBottomRight.x > 0 && pullBottomRight.y > 0);
});

test('computeContainedArtifactCursorOffset pulls toward pointer within bounded radius', () => {
  const rect = { left: 100, top: 200, width: 400, height: 240 };

  const topLeftHover = computeContainedArtifactCursorOffset({
    clientX: 110,
    clientY: 210,
    cardRect: rect,
    maxPullPx: 22,
  });
  assert.ok(topLeftHover.x < 0 && topLeftHover.y < 0);
  assert.equal(topLeftHover.scale, 1.08);
});

test('shouldEnableComplexArtifactPhysics disables heavy motion on mobile, reduced-motion, or low-core devices', () => {
  assert.equal(
    shouldEnableComplexArtifactPhysics({
      isDesktopViewport: true,
      prefersReducedMotion: false,
      hardwareConcurrency: 8,
    }),
    true
  );

  assert.equal(
    shouldEnableComplexArtifactPhysics({
      isDesktopViewport: false,
      prefersReducedMotion: false,
      hardwareConcurrency: 8,
    }),
    false
  );

  assert.equal(
    shouldEnableComplexArtifactPhysics({
      isDesktopViewport: true,
      prefersReducedMotion: true,
      hardwareConcurrency: 8,
    }),
    false
  );

  assert.equal(
    shouldEnableComplexArtifactPhysics({
      isDesktopViewport: true,
      prefersReducedMotion: false,
      hardwareConcurrency: 2,
    }),
    false
  );
});
