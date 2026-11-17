import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatLessonSyncStatusMessage,
  normalizeLessonIdList,
  reconcileCompletedLessonIds,
} from './lesson-sync';

test('normalizeLessonIdList deduplicates, trims, and preserves canonical lesson order', () => {
  const ordered = normalizeLessonIdList(
    [' les-3 ', 'les-1', 'les-3', '', 'unknown-les'],
    ['les-1', 'les-2', 'les-3']
  );
  assert.deepEqual(ordered, ['les-1', 'les-3']);

  const withoutCatalog = normalizeLessonIdList(['a', 'b', 'a', '  ']);
  assert.deepEqual(withoutCatalog, ['a', 'b']);
});

test('reconcileCompletedLessonIds finds missingOnServer, missingLocally, and produces merged union', () => {
  const result = reconcileCompletedLessonIds({
    localIds: ['les-1', 'les-3'],
    serverIds: ['les-1', 'les-2'],
    validCourseLessonIds: ['les-1', 'les-2', 'les-3', 'les-4'],
  });

  assert.deepEqual(result.missingOnServer, ['les-3']);
  assert.deepEqual(result.missingLocally, ['les-2']);
  assert.deepEqual(result.mergedIds, ['les-1', 'les-2', 'les-3']);
  assert.equal(result.inSync, false);
});

test('reconcileCompletedLessonIds reports inSync when local and server sets match', () => {
  const result = reconcileCompletedLessonIds({
    localIds: ['les-2', 'les-1'],
    serverIds: ['les-1', 'les-2'],
    validCourseLessonIds: ['les-1', 'les-2', 'les-3'],
  });

  assert.deepEqual(result.missingOnServer, []);
  assert.deepEqual(result.missingLocally, []);
  assert.deepEqual(result.mergedIds, ['les-1', 'les-2']);
  assert.equal(result.inSync, true);
});

test('formatLessonSyncStatusMessage formats EN and UZ sync outcomes clearly', () => {
  assert.equal(
    formatLessonSyncStatusMessage({
      locale: 'en',
      pushedCount: 1,
      pulledCount: 2,
      totalSynced: 3,
    }),
    'Synced: 1 uploaded, 2 pulled from server'
  );

  assert.equal(
    formatLessonSyncStatusMessage({
      locale: 'en',
      pushedCount: 0,
      pulledCount: 0,
      totalSynced: 4,
    }),
    'Up to date · 4 completed lessons synced'
  );

  assert.equal(
    formatLessonSyncStatusMessage({
      locale: 'uz',
      pushedCount: 0,
      pulledCount: 0,
      totalSynced: 0,
      unauthenticated: true,
    }),
    'Qurilmalararo sinxronlash uchun hisobga kiring.'
  );
});
