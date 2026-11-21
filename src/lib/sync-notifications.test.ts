import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationCopy } from './notification-copy';
import { SYNC_NOTIFICATION_ID, createNotificationStore } from './notifications';
import { createSyncStatusController } from './sync-notifications';
import { createFakeScheduler, flushMicrotasks } from './notification-test-utils';

function setup(options: { reconcile?: () => Promise<void> | void; locale?: 'en' | 'uz'; initiallyOffline?: boolean } = {}) {
  const scheduler = createFakeScheduler();
  const store = createNotificationStore({ scheduler });
  let locale: 'en' | 'uz' = options.locale ?? 'en';
  const phases: string[] = [];
  const controller = createSyncStatusController({
    store,
    scheduler,
    getCopy: () => notificationCopy(locale),
    reconcile: options.reconcile,
    minSyncMs: 2000,
    retryDelayMs: 1300,
    syncedHoldMs: 2400,
    initiallyOffline: options.initiallyOffline,
    onPhaseChange: (p) => phases.push(p),
  });
  const syncToast = () => store.getSnapshot().find((r) => r.id === SYNC_NOTIFICATION_ID);
  return { scheduler, store, controller, phases, syncToast, setLocale: (l: 'en' | 'uz') => (locale = l) };
}

test('offline → online reconnect shows offline, reconciling and complete states in one toast slot', async () => {
  const { scheduler, store, controller, syncToast } = setup({ reconcile: async () => {} });

  controller.handleOffline();
  assert.equal(syncToast()?.tone, 'warning');
  assert.equal(syncToast()?.title, '[ UPLINK OFFLINE :: LOCAL BUFFER ACTIVE ]');
  assert.equal(syncToast()?.durationMs, null, 'offline toast stays until reconnect');

  controller.handleOnline();
  assert.equal(syncToast()?.tone, 'progress');
  assert.equal(syncToast()?.title, '[ UPLINK REESTABLISHED :: RECONCILING DATA... ]');
  assert.equal(syncToast()?.dismissible, false);

  await flushMicrotasks();
  scheduler.advance(1999);
  await flushMicrotasks();
  assert.equal(syncToast()?.tone, 'progress', 'reconciling stays visible for the minimum duration');

  scheduler.advance(1);
  await flushMicrotasks();
  assert.equal(syncToast()?.tone, 'success');
  assert.equal(syncToast()?.title, '[ RECONCILIATION: COMPLETE ]');
  assert.equal(store.getSnapshot().length, 1);

  scheduler.advance(2400);
  assert.equal(syncToast(), undefined, 'complete toast auto-dismisses');
  assert.equal(controller.getPhase(), 'idle');
});

test('coming online without having been offline does not start a sync', () => {
  const { controller, syncToast } = setup();
  controller.handleOnline();
  assert.equal(syncToast(), undefined);
  assert.equal(controller.getPhase(), 'idle');
});

test('a failed reconcile enters conflict, retries once automatically, then succeeds', async () => {
  let calls = 0;
  const { scheduler, controller, syncToast, phases } = setup({
    reconcile: async () => {
      calls += 1;
      if (calls === 1) throw new Error('503 upstream');
    },
  });

  void controller.reconcileNow();
  await flushMicrotasks();
  assert.equal(syncToast()?.tone, 'error');
  assert.equal(syncToast()?.title, '[ SYNC CONFLICT :: RETRYING ]');
  assert.equal(syncToast()?.message, '503 upstream');

  scheduler.advance(1300);
  await flushMicrotasks();
  assert.equal(syncToast()?.tone, 'progress');
  assert.equal(calls, 2);

  scheduler.advance(2000);
  await flushMicrotasks();
  assert.equal(syncToast()?.tone, 'success');
  assert.deepEqual(phases, ['syncing', 'conflict', 'syncing', 'synced']);
});

test('when the retry also fails, a sticky failed toast offers a working Retry action', async () => {
  let shouldFail = true;
  let calls = 0;
  const { scheduler, controller, syncToast } = setup({
    reconcile: async () => {
      calls += 1;
      if (shouldFail) throw new Error('offline');
    },
  });

  void controller.reconcileNow();
  await flushMicrotasks();
  scheduler.advance(1300);
  await flushMicrotasks();

  const failed = syncToast();
  assert.equal(failed?.tone, 'error');
  assert.equal(failed?.title, '[ SYNC FAILED :: ACTION REQUIRED ]');
  assert.equal(failed?.durationMs, null);
  assert.equal(failed?.action?.label, 'Retry');
  assert.equal(controller.getPhase(), 'failed');

  shouldFail = false;
  failed?.action?.onAction();
  await flushMicrotasks();
  assert.equal(syncToast()?.tone, 'progress');
  scheduler.advance(2000);
  await flushMicrotasks();
  assert.equal(syncToast()?.tone, 'success');
  assert.equal(calls, 3);
});

test('going offline mid-sync cancels the stale reconcile result', async () => {
  let resolveReconcile: () => void = () => {};
  const { scheduler, controller, syncToast } = setup({
    reconcile: () => new Promise<void>((resolve) => (resolveReconcile = resolve)),
  });

  void controller.reconcileNow();
  controller.handleOffline();
  resolveReconcile();
  scheduler.advance(5000);
  await flushMicrotasks();
  assert.equal(syncToast()?.tone, 'warning');
  assert.equal(controller.getPhase(), 'offline');
});

test('sync toasts follow the active locale, including refresh after a language switch', () => {
  const { controller, syncToast, setLocale } = setup({ initiallyOffline: true });
  controller.refresh();
  assert.equal(syncToast()?.title, '[ UPLINK OFFLINE :: LOCAL BUFFER ACTIVE ]');

  setLocale('uz');
  controller.refresh();
  assert.equal(syncToast()?.title, '[ ALOQA UZILDI :: MAHALLIY BUFER FAOL ]');
});
