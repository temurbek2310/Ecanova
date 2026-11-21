import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NOTIFICATION_DURATIONS,
  createNotificationApi,
  createNotificationStore,
  describeError,
  reconcilePresence,
} from './notifications';
import { createFakeScheduler } from './notification-test-utils';

test('notify adds a toast with tone defaults and auto-dismisses after its duration', () => {
  const scheduler = createFakeScheduler();
  const store = createNotificationStore({ scheduler });
  const id = store.notify({ tone: 'success', title: 'Lesson complete' });

  const [record] = store.getSnapshot();
  assert.equal(record?.id, id);
  assert.equal(record?.durationMs, DEFAULT_NOTIFICATION_DURATIONS.success);
  assert.equal(record?.dismissible, true);

  scheduler.advance(DEFAULT_NOTIFICATION_DURATIONS.success! - 1);
  assert.equal(store.getSnapshot().length, 1);
  scheduler.advance(1);
  assert.equal(store.getSnapshot().length, 0);
});

test('progress toasts are sticky until updated, then follow the new tone duration', () => {
  const scheduler = createFakeScheduler();
  const store = createNotificationStore({ scheduler });
  store.notify({ id: 'sync', tone: 'progress', title: 'Syncing' });
  scheduler.advance(60_000);
  assert.equal(store.getSnapshot().length, 1);

  assert.equal(store.update('sync', { tone: 'success', title: 'Synced' }), true);
  const [record] = store.getSnapshot();
  assert.equal(record?.title, 'Synced');
  assert.equal(record?.durationMs, DEFAULT_NOTIFICATION_DURATIONS.success);
  scheduler.advance(DEFAULT_NOTIFICATION_DURATIONS.success!);
  assert.equal(store.getSnapshot().length, 0);
  assert.equal(store.update('missing', { title: 'x' }), false);
});

test('re-using an id upserts in place instead of stacking a second toast', () => {
  const store = createNotificationStore({ scheduler: createFakeScheduler() });
  store.notify({ id: 'a', title: 'First' });
  store.notify({ id: 'b', title: 'Other' });
  store.notify({ id: 'a', tone: 'error', title: 'Updated' });
  const snapshot = store.getSnapshot();
  assert.deepEqual(
    snapshot.map((r) => [r.id, r.title, r.tone]),
    [
      ['b', 'Other', 'info'],
      ['a', 'Updated', 'error'],
    ]
  );
});

test('identical anonymous toasts collapse into one', () => {
  const store = createNotificationStore({ scheduler: createFakeScheduler() });
  store.notify({ tone: 'success', title: 'Copied', message: 'ABC' });
  store.notify({ tone: 'success', title: 'Copied', message: 'ABC' });
  store.notify({ tone: 'success', title: 'Copied', message: 'XYZ' });
  assert.equal(store.getSnapshot().length, 2);
});

test('stack is capped, evicting the oldest auto-dismissing toast before sticky ones', () => {
  const store = createNotificationStore({ scheduler: createFakeScheduler(), maxVisible: 3 });
  store.notify({ id: 'sticky', tone: 'progress', title: 'Sync' });
  store.notify({ id: 't1', title: '1' });
  store.notify({ id: 't2', title: '2' });
  store.notify({ id: 't3', title: '3' });
  assert.deepEqual(
    store.getSnapshot().map((r) => r.id),
    ['sticky', 't2', 't3']
  );
});

test('manual dismiss removes the toast and cancels its timer', () => {
  const scheduler = createFakeScheduler();
  const store = createNotificationStore({ scheduler });
  const id = store.notify({ title: 'Hello' });
  assert.equal(scheduler.pendingCount(), 1);
  store.dismiss(id);
  assert.equal(store.getSnapshot().length, 0);
  assert.equal(scheduler.pendingCount(), 0);
});

test('pause freezes the countdown and resume continues with a grace period', () => {
  const scheduler = createFakeScheduler();
  const store = createNotificationStore({ scheduler });
  const id = store.notify({ title: 'Hover me', durationMs: 4000 });
  scheduler.advance(3000);
  store.pause(id);
  scheduler.advance(30_000);
  assert.equal(store.getSnapshot().length, 1, 'paused toast must not dismiss');

  store.resume(id);
  scheduler.advance(1199);
  assert.equal(store.getSnapshot().length, 1, 'resume grants at least 1200ms');
  scheduler.advance(1);
  assert.equal(store.getSnapshot().length, 0);
});

test('subscribers are notified on change and can unsubscribe', () => {
  const store = createNotificationStore({ scheduler: createFakeScheduler() });
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });
  store.notify({ title: 'one' });
  store.clear();
  unsubscribe();
  store.notify({ title: 'two' });
  assert.equal(calls, 2);
});

test('api.task shows progress then success, and surfaces errors before re-throwing', async () => {
  const store = createNotificationStore({ scheduler: createFakeScheduler() });
  const api = createNotificationApi(store);

  const result = await api.task(async () => 42, {
    id: 'job',
    pending: { title: 'Working' },
    success: (n) => ({ title: `Done ${n}` }),
    error: { title: 'Failed', fallback: 'fallback' },
  });
  assert.equal(result, 42);
  assert.equal(store.getSnapshot()[0]?.title, 'Done 42');
  assert.equal(store.getSnapshot()[0]?.tone, 'success');

  await assert.rejects(
    api.task(
      async () => {
        throw new Error('Transition blocked: needs rights review');
      },
      { id: 'job', pending: { title: 'Working' }, success: { title: 'ok' }, error: { title: 'Failed', fallback: 'x' } }
    )
  );
  const [record] = store.getSnapshot();
  assert.equal(record?.tone, 'error');
  assert.equal(record?.title, 'Failed');
  assert.equal(record?.message, 'Transition blocked: needs rights review');
});

test('progress helper defaults to a non-dismissible sticky toast', () => {
  const store = createNotificationStore({ scheduler: createFakeScheduler() });
  const api = createNotificationApi(store);
  api.progress('Syncing', null, { id: 'p' });
  const [record] = store.getSnapshot();
  assert.equal(record?.dismissible, false);
  assert.equal(record?.durationMs, null);
});

test('describeError prefers the thrown message and falls back otherwise', () => {
  assert.equal(describeError(new Error('Server says no'), 'fallback'), 'Server says no');
  assert.equal(describeError('plain string', 'fallback'), 'plain string');
  assert.equal(describeError(new Error('   '), 'fallback'), 'fallback');
  assert.equal(describeError(undefined, 'fallback'), 'fallback');
});

test('reconcilePresence keeps removed toasts as leaving so they can animate out', () => {
  const store = createNotificationStore({ scheduler: createFakeScheduler() });
  store.notify({ id: 'a', title: 'A' });
  store.notify({ id: 'b', title: 'B' });
  const first = reconcilePresence([], store.getSnapshot());
  assert.deepEqual(first.map((i) => [i.record.id, i.leaving]), [
    ['a', false],
    ['b', false],
  ]);

  store.dismiss('a');
  store.notify({ id: 'c', title: 'C' });
  const second = reconcilePresence(first, store.getSnapshot());
  assert.deepEqual(second.map((i) => [i.record.id, i.leaving]), [
    ['a', true],
    ['b', false],
    ['c', false],
  ]);

  // A leaving toast that is re-notified comes back as live.
  store.notify({ id: 'a', title: 'A again' });
  const third = reconcilePresence(second, store.getSnapshot());
  assert.deepEqual(third.map((i) => [i.record.id, i.leaving]), [
    ['b', false],
    ['c', false],
    ['a', false],
  ]);
});
