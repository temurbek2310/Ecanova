import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SYNC_HUD_MESSAGES,
  computeCryptographicScrambleFrame,
  mapMilestoneToNodeUnlock,
  resolveNetworkTransition,
  resolveNodeArtifactSpec,
} from './node-unlock';

test('resolveNetworkTransition detects offline entry and offline->online sync triggers', () => {
  assert.equal(
    resolveNetworkTransition({ wasOffline: false, isNowOnline: false }),
    'enter_offline'
  );
  assert.equal(
    resolveNetworkTransition({ wasOffline: true, isNowOnline: true }),
    'start_sync'
  );
  assert.equal(
    resolveNetworkTransition({ wasOffline: false, isNowOnline: true }),
    'none'
  );
  assert.equal(SYNC_HUD_MESSAGES.syncing, '[ UPLINK REESTABLISHED :: RECONCILING DATA... ]');
  assert.equal(SYNC_HUD_MESSAGES.synced, '[ RECONCILIATION: COMPLETE ]');
  assert.equal(SYNC_HUD_MESSAGES.complete, '[ RECONCILIATION: COMPLETE ]');
  assert.equal(SYNC_HUD_MESSAGES.conflict, '[ SYNC CONFLICT :: RETRYING ]');
});

test('computeCryptographicScrambleFrame preserves length/spaces and resolves cleanly at progress=1', () => {
  const target = 'MARKET EQUILIBRIUM MASTERED';
  const mid = computeCryptographicScrambleFrame(target, 0.45, 9);
  assert.equal(mid.length, target.length);
  assert.equal(mid[6], ' ');
  assert.ok(mid.startsWith('MARKET'));
  assert.notEqual(mid, target);

  const done = computeCryptographicScrambleFrame(target, 1, 9);
  assert.equal(done, target);
});

test('resolveNodeArtifactSpec enforces Glass-Brutalism brand palette and #9274FF shadow', () => {
  const econ = resolveNodeArtifactSpec('Economics');
  assert.equal(econ.primaryHex, '#5DE1D2');
  assert.equal(econ.shadowHex, '#9274FF');

  const math = resolveNodeArtifactSpec('Mathematics');
  assert.equal(math.primaryHex, '#9274FF');

  const biz = resolveNodeArtifactSpec('Business');
  assert.equal(biz.primaryHex, '#6FE0A1');
});

test('mapMilestoneToNodeUnlock maps academic course completion without cheap gamification', () => {
  const node = mapMilestoneToNodeUnlock(
    {
      id: 'course-course-macro-stabilization-123',
      kind: 'course_completed',
      title: 'Course Completed!',
      subtitle: 'All required lessons and the final assessment passed.',
      accentTone: 'success',
    },
    'en'
  );

  assert.equal(node.subject, 'Economics');
  assert.equal(node.title, 'MARKET EQUILIBRIUM MASTERED');
  assert.equal(node.nodeCode, 'NODE-ECON-100');
});
