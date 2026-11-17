import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GEOMETRIC_NOVA_ACCENTS,
  LESSON_MILESTONE_TARGET,
  buildGeometricShards,
  hasReachedLessonMilestone,
} from './geometric-nova';

test('hasReachedLessonMilestone triggers strictly at or above the 50th lesson', () => {
  assert.equal(LESSON_MILESTONE_TARGET, 50);
  assert.equal(hasReachedLessonMilestone(0), false);
  assert.equal(hasReachedLessonMilestone(49), false);
  assert.equal(hasReachedLessonMilestone(-5), false);
  assert.equal(hasReachedLessonMilestone(50), true);
  assert.equal(hasReachedLessonMilestone(64), true);
});

test('buildGeometricShards produces crystalline polygon shards with ECONOVA accent colors and opacity bounds', () => {
  const shards = buildGeometricShards(36);
  assert.equal(shards.length, 36);

  const allowedColors = new Set<string>(GEOMETRIC_NOVA_ACCENTS);
  for (const shard of shards) {
    assert.ok(allowedColors.has(shard.color));
    assert.ok(shard.opacity >= 0.2 && shard.opacity <= 0.8);
    assert.ok(shard.strokeWidth >= 2);
    assert.ok(shard.points.split(' ').length >= 3);
    assert.ok(shard.fallY >= 240);
    assert.ok(Math.hypot(shard.explodeX, shard.explodeY) >= 80);
  }
});
