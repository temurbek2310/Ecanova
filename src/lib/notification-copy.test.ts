import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFICATION_COPY, notificationCopy } from './notification-copy';
import { describeEditorialTransitionOutcome } from './editorial-notifications';
import { SYNC_HUD_MESSAGES } from './node-unlock';

type Leaf = string | ((...args: never[]) => string);

function collectLeaves(value: unknown, prefix = ''): Map<string, Leaf> {
  const out = new Map<string, Leaf>();
  if (typeof value === 'string' || typeof value === 'function') {
    out.set(prefix, value as Leaf);
    return out;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    for (const [k, v] of collectLeaves(child, prefix ? `${prefix}.${key}` : key)) out.set(k, v);
  }
  return out;
}

test('en and uz notification catalogs have identical keys and non-empty entries', () => {
  const en = collectLeaves(NOTIFICATION_COPY.en);
  const uz = collectLeaves(NOTIFICATION_COPY.uz);
  assert.deepEqual([...uz.keys()].sort(), [...en.keys()].sort());

  for (const [key, enValue] of en) {
    const uzValue = uz.get(key)!;
    assert.equal(typeof uzValue, typeof enValue, `type mismatch at ${key}`);
    const sample = (v: Leaf) =>
      typeof v === 'function' ? (v as (...args: unknown[]) => string)('X', 'Y') : v;
    assert.ok(sample(enValue).trim().length > 0, `empty en copy at ${key}`);
    assert.ok(sample(uzValue).trim().length > 0, `empty uz copy at ${key}`);
  }
});

test('notificationCopy falls back to English for unknown locales', () => {
  assert.equal(notificationCopy('uz').common.dismiss, 'Bildirishnomani yopish');
  assert.equal(notificationCopy('xx' as never).common.dismiss, 'Dismiss notification');
});

test('English sync copy keeps the original telemetry HUD wording', () => {
  const en = notificationCopy('en').sync;
  assert.equal(en.offline, SYNC_HUD_MESSAGES.offline);
  assert.equal(en.reconciling, SYNC_HUD_MESSAGES.syncing);
  assert.equal(en.synced, SYNC_HUD_MESSAGES.synced);
  assert.equal(en.conflict, SYNC_HUD_MESSAGES.conflict);
});

test('editorial outcomes distinguish sign-off, restore, publish, retire and plain moves', () => {
  const copy = notificationCopy('en');
  const base = { copy, statusLabel: 'Approved', signoffType: null } as const;

  assert.equal(
    describeEditorialTransitionOutcome({ ...base, previousStatus: 'subject_review', nextStatus: 'language_review', signoffType: 'subject', statusLabel: 'Language review' }).title,
    'Sign-off recorded · Language review'
  );
  assert.equal(
    describeEditorialTransitionOutcome({ ...base, previousStatus: 'retired', nextStatus: 'approved' }).title,
    'Restored to Approved'
  );
  assert.equal(
    describeEditorialTransitionOutcome({ ...base, previousStatus: 'approved', nextStatus: 'published' }).title,
    'Edition published'
  );
  assert.equal(
    describeEditorialTransitionOutcome({ ...base, previousStatus: 'published', nextStatus: 'retired' }).title,
    'Edition retired'
  );
  assert.equal(
    describeEditorialTransitionOutcome({ ...base, previousStatus: 'rights_accessibility_review', nextStatus: 'approved' }).title,
    'Edition moved to Approved'
  );
  assert.equal(
    describeEditorialTransitionOutcome({ ...base, copy: notificationCopy('uz'), previousStatus: 'retired', nextStatus: 'approved' }).title,
    'Tasdiqlangan holatga qaytarildi'
  );
});
