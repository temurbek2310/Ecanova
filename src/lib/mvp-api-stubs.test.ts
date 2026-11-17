import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuthMePayload,
  buildCatalogPayload,
  buildHealthPayload,
  buildLeaderboardsPayload,
  resolveMvpApiFallbackPayload,
} from './mvp-api-stubs';

test('buildHealthPayload returns ok status and ISO timestamp', () => {
  const fixedDate = new Date('2026-03-26T12:00:00.000Z');
  const payload = buildHealthPayload(fixedDate);
  assert.equal(payload.status, 'ok');
  assert.equal(payload.ok, true);
  assert.equal(payload.timestamp, '2026-03-26T12:00:00.000Z');
  assert.equal(payload.databaseConfigured, true);
});

test('buildAuthMePayload returns Guest User payload with student role for pitch deck bypass', () => {
  const payload = buildAuthMePayload();
  assert.equal(payload.id, '1');
  assert.equal(payload.name, 'Guest User');
  assert.equal(payload.role, 'student');
  assert.equal(payload.user.displayName, 'Guest User');
  assert.equal(payload.user.id, '1');
});

test('buildCatalogPayload returns Math, Economics, and Business courses with bilingual editions', () => {
  const payload = buildCatalogPayload();
  assert.ok(payload.courses.length >= 6);
  const subjects = new Set(payload.courses.map((c) => c.subject));
  assert.ok(subjects.has('Mathematics'));
  assert.ok(subjects.has('Economics'));
  assert.ok(subjects.has('Business'));
  for (const course of payload.courses) {
    assert.ok(course.editions.en);
    assert.ok(course.editions.uz);
  }
});

test('buildLeaderboardsPayload returns quizLeaderboard and filters by courseId', () => {
  const allPayload = buildLeaderboardsPayload('all');
  assert.ok(allPayload.quizLeaderboard.length >= 6);
  assert.ok(allPayload.entries.length >= 5);

  const filtered = buildLeaderboardsPayload('course-quant-calculus');
  assert.equal(filtered.quizLeaderboard.length, 1);
  assert.equal(filtered.quizLeaderboard[0]?.courseId, 'course-quant-calculus');
  assert.equal(filtered.quizLeaderboard[0]?.rank, 1);
});

test('resolveMvpApiFallbackPayload maps all 4 core endpoints cleanly', () => {
  assert.ok(resolveMvpApiFallbackPayload('/api/health'));
  assert.ok(resolveMvpApiFallbackPayload('/api/auth/me'));
  assert.ok(resolveMvpApiFallbackPayload('/api/catalog'));
  assert.ok(resolveMvpApiFallbackPayload('/api/leaderboards'));
  assert.equal(resolveMvpApiFallbackPayload('/api/unknown-endpoint'), null);
});
