import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import {
  completionRejectedResponse,
  computeMinDwellSeconds,
  decideLessonCompletion,
  invalidEvidenceResponse,
  LESSON_EVIDENCE_TYPES,
  MAX_DWELL_SECONDS,
  MIN_DWELL_SECONDS,
  parseLessonEvidence,
  type LessonCompletionInput,
  type ProgressRowFacts,
} from './lesson-progress-policy.ts';

const NOW = new Date('2026-11-20T10:00:00.000Z');
const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000);

function input(overrides: Partial<LessonCompletionInput>): LessonCompletionInput {
  return {
    evidence: 'lesson_read',
    lessonEstimatedMinutes: 10, // -> 120s minimum dwell
    existing: null,
    isEnrolled: true,
    hasPassedEditionAssessment: false,
    now: NOW,
    ...overrides,
  };
}

test('evidence: allowlisted values pass, legacy client values map, anything else is rejected', () => {
  for (const value of LESSON_EVIDENCE_TYPES) {
    assert.deepEqual(parseLessonEvidence(value), { ok: true, evidence: value });
  }
  assert.deepEqual(parseLessonEvidence('study_and_practice'), { ok: true, evidence: 'lesson_read' });
  assert.deepEqual(parseLessonEvidence('study_and_simulation'), { ok: true, evidence: 'interactive_check' });
  assert.deepEqual(parseLessonEvidence('manual_syllabus_sync'), { ok: true, evidence: 'local_sync' });

  for (const bad of [undefined, null, '', '   ', 42, 'watched_everything', 'toString', '__proto__']) {
    assert.equal(parseLessonEvidence(bad).ok, false, String(bad));
  }
});

test('minimum dwell is 20% of the estimate, clamped to 20s..180s', () => {
  assert.equal(computeMinDwellSeconds(10), 120);
  assert.equal(computeMinDwellSeconds(1), MIN_DWELL_SECONDS);
  assert.equal(computeMinDwellSeconds(60), MAX_DWELL_SECONDS);
  assert.equal(computeMinDwellSeconds(0), MIN_DWELL_SECONDS);
  assert.equal(computeMinDwellSeconds(Number.NaN), MIN_DWELL_SECONDS);
});

test('completion without a server-recorded start is rejected', () => {
  const d = decideLessonCompletion(input({ existing: null }));
  assert.equal(d.ok, false);
  assert.equal(!d.ok && d.code, 'lesson_not_started');
  assert.equal(!d.ok && d.status, 422);
});

test('premature completion is rejected with the seconds remaining', () => {
  const started: ProgressRowFacts = { state: 'in_progress', updatedAt: secondsAgo(30) };
  const d = decideLessonCompletion(input({ existing: started }));
  assert.equal(d.ok, false);
  if (!d.ok) {
    assert.equal(d.code, 'min_dwell_not_met');
    assert.equal(d.retryAfterSeconds, 90);
    assert.equal(d.minDwellSeconds, 120);
  }
});

test('completion after the minimum dwell is accepted', () => {
  for (const evidence of ['lesson_read', 'interactive_check'] as const) {
    const d = decideLessonCompletion(
      input({ evidence, existing: { state: 'in_progress', updatedAt: secondsAgo(120) } })
    );
    assert.deepEqual(d, { ok: true, alreadyCompleted: false, evidence });
  }
});

test('already-completed lessons stay idempotent (re-sync, double click)', () => {
  const d = decideLessonCompletion(
    input({ evidence: 'local_sync', existing: { state: 'completed', updatedAt: secondsAgo(5) }, isEnrolled: false })
  );
  assert.deepEqual(d, { ok: true, alreadyCompleted: true, evidence: 'local_sync' });
});

test('assessment_passed needs a passed server-graded attempt, then skips dwell', () => {
  const missing = decideLessonCompletion(input({ evidence: 'assessment_passed' }));
  assert.equal(!missing.ok && missing.code, 'assessment_not_passed');

  const passed = decideLessonCompletion(
    input({ evidence: 'assessment_passed', hasPassedEditionAssessment: true })
  );
  assert.deepEqual(passed, { ok: true, alreadyCompleted: false, evidence: 'assessment_passed' });
});

test('local_sync grace: enrolled offline completions sync; started lessons still need dwell', () => {
  assert.equal(decideLessonCompletion(input({ evidence: 'local_sync', isEnrolled: true })).ok, true);

  const notEnrolled = decideLessonCompletion(input({ evidence: 'local_sync', isEnrolled: false }));
  assert.equal(!notEnrolled.ok && notEnrolled.code, 'not_enrolled');

  const tooSoon = decideLessonCompletion(
    input({ evidence: 'local_sync', existing: { state: 'in_progress', updatedAt: secondsAgo(10) } })
  );
  assert.equal(!tooSoon.ok && tooSoon.code, 'min_dwell_not_met');
});

// --- HTTP status mapping, through the same helpers server.ts uses ---

async function withProgressServer(
  facts: Omit<LessonCompletionInput, 'evidence' | 'now'>,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.put('/api/me/progress/:lessonId', (req, res) => {
    const parsed = parseLessonEvidence(req.body?.evidence);
    if (!parsed.ok) {
      const r = invalidEvidenceResponse(parsed);
      res.status(r.status).json(r.body);
      return;
    }
    const decision = decideLessonCompletion({ ...facts, evidence: parsed.evidence, now: NOW });
    if (!decision.ok) {
      const r = completionRejectedResponse(decision);
      res.status(r.status).json(r.body);
      return;
    }
    res.json({ ok: true, alreadyCompleted: decision.alreadyCompleted, evidence: decision.evidence });
  });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function put(base: string, body: unknown) {
  const res = await fetch(`${base}/api/me/progress/lesson-1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

test('HTTP: invalid evidence 400, premature 422, verified completion 200', async () => {
  const base = {
    lessonEstimatedMinutes: 10,
    isEnrolled: true,
    hasPassedEditionAssessment: false,
  };

  await withProgressServer(
    { ...base, existing: { state: 'in_progress', updatedAt: secondsAgo(15) } },
    async (url) => {
      const invalid = await put(url, { evidence: 'i_promise_i_read_it' });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.body.code, 'invalid_evidence');

      const missing = await put(url, {});
      assert.equal(missing.status, 400);

      const early = await put(url, { evidence: 'lesson_read' });
      assert.equal(early.status, 422);
      assert.equal(early.body.code, 'min_dwell_not_met');
      assert.equal(early.body.retryAfterSeconds, 105);
    }
  );

  await withProgressServer(
    { ...base, existing: { state: 'in_progress', updatedAt: secondsAgo(200) } },
    async (url) => {
      const ok = await put(url, { evidence: 'lesson_read' });
      assert.equal(ok.status, 200);
      assert.deepEqual(ok.body, { ok: true, alreadyCompleted: false, evidence: 'lesson_read' });
    }
  );

  await withProgressServer({ ...base, existing: null }, async (url) => {
    const notStarted = await put(url, { evidence: 'interactive_check' });
    assert.equal(notStarted.status, 422);
    assert.equal(notStarted.body.code, 'lesson_not_started');
  });
});
