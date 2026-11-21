import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createNotificationApi, createNotificationStore, createToastSlotReporter } from './notifications';
import { createFakeScheduler } from './notification-test-utils';
import { notificationCopy } from './notification-copy';

const SRC_ROOT = join(process.cwd(), 'src');

function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listTsxFiles(full));
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

// The toast viewport is the one place allowed to render alert/status roles.
// The marketing landing page uses role="status" for a decorative seal, and
// MilestoneCelebration is an (unmounted) celebration card, not feedback.
const ALLOWED_FILES = new Set(
  ['components/NotificationViewport.tsx', 'components/landing/LandingPage.tsx', 'components/MilestoneCelebration.tsx'].map(
    (p) => p.split('/').join(sep)
  )
);

test('no inline alert/status banners remain in src/ outside the notification viewport', () => {
  const offenders: string[] = [];
  for (const file of listTsxFiles(SRC_ROOT)) {
    const rel = relative(SRC_ROOT, file);
    if (ALLOWED_FILES.has(rel)) continue;
    const source = readFileSync(file, 'utf8');
    source.split('\n').forEach((line, idx) => {
      if (/role=\{?["'](alert|status)["']\}?/.test(line) || /role=\{[^}]*['"]alert['"]/.test(line)) {
        offenders.push(`${rel}:${idx + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `Inline feedback boxes must use notify():\n${offenders.join('\n')}`);
});

test('no component keeps ad-hoc inline feedback state (errorMsg, statusMsg, actionMsg, …)', () => {
  const pattern =
    /const \[(errorMsg|actionMsg|statusMsg|digestMsg|notifMsg|cacheStatusMsg|reportStatus|reviewStatus|shareStatus|shareFeedback|exportFeedback|copyFeedback|feedback|savedNotice|autoSubmittedNotice|dictationNotice|imgError|catalogError|courseError|serverVerifyError|syllabusSyncNote),/;
  const offenders: string[] = [];
  for (const file of listTsxFiles(SRC_ROOT)) {
    const source = readFileSync(file, 'utf8');
    source.split('\n').forEach((line, idx) => {
      if (pattern.test(line)) offenders.push(`${relative(SRC_ROOT, file)}:${idx + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('createToastSlotReporter replaces setErrorMsg: message shows/updates one slot, null clears it', () => {
  const store = createNotificationStore({ scheduler: createFakeScheduler() });
  const api = createNotificationApi(store);
  const copy = notificationCopy('uz');
  const setErrorMsg = createToastSlotReporter(api, 'auth-page-error', copy.auth.failed);

  setErrorMsg('Noto‘g‘ri parol');
  setErrorMsg('Tarmoq xatosi');
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.length, 1, 'repeated errors reuse the same toast slot');
  assert.equal(snapshot[0]?.id, 'auth-page-error');
  assert.equal(snapshot[0]?.tone, 'error');
  assert.equal(snapshot[0]?.title, 'Kirish amalga oshmadi');
  assert.equal(snapshot[0]?.message, 'Tarmoq xatosi');

  setErrorMsg(null);
  assert.equal(store.getSnapshot().length, 0);
  setErrorMsg('   ');
  assert.equal(store.getSnapshot().length, 0, 'blank messages never produce empty toasts');
});

test('validation reporters use the warning tone with localized titles', () => {
  const store = createNotificationStore({ scheduler: createFakeScheduler() });
  const api = createNotificationApi(store);
  createToastSlotReporter(api, 'assessment-validation', notificationCopy('en').validation.incompleteAssessment, 'warning')(
    'Please answer every question before submitting.'
  );
  createToastSlotReporter(api, 'daily-goal-validation', notificationCopy('uz').validation.invalidGoal, 'warning')(
    'Maqsad 5–240 daqiqa oralig‘ida bo‘lishi kerak.'
  );
  assert.deepEqual(
    store.getSnapshot().map((r) => [r.id, r.tone, r.title]),
    [
      ['assessment-validation', 'warning', 'Answer every question first'],
      ['daily-goal-validation', 'warning', 'Kunlik maqsad noto‘g‘ri'],
    ]
  );
});
