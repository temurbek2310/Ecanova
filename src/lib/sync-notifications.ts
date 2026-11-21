import type { NotificationCopy } from './notification-copy';
import { SYNC_NOTIFICATION_ID, describeError, type NotificationStore } from './notifications';
import {
  SYNC_HUD_COMPLETE_HOLD_MS,
  SYNC_HUD_CONFLICT_RETRY_MS,
  SYNC_HUD_DURATION_MS,
  resolveNetworkTransition,
} from './node-unlock';

export type SyncNotificationPhase = 'idle' | 'offline' | 'syncing' | 'synced' | 'conflict' | 'failed';

export interface SyncStatusControllerOptions {
  store: NotificationStore;
  /** Read lazily so every transition uses the active locale. */
  getCopy: () => NotificationCopy;
  /** Reconciles persisted/local data with the server. Rejecting marks the sync as failed. */
  reconcile?: () => Promise<void> | void;
  scheduler?: {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
  };
  /** Minimum time the "reconciling" state stays visible so it never flashes. */
  minSyncMs?: number;
  /** Delay before the single automatic retry after a conflict. */
  retryDelayMs?: number;
  /** How long the "complete" toast is shown. */
  syncedHoldMs?: number;
  initiallyOffline?: boolean;
  onPhaseChange?: (phase: SyncNotificationPhase) => void;
}

export interface SyncStatusController {
  getPhase: () => SyncNotificationPhase;
  handleOffline: () => void;
  handleOnline: () => void;
  /** Starts a reconciliation immediately (manual trigger). */
  reconcileNow: () => Promise<void>;
  /** Forces the conflict state followed by an automatic retry. */
  triggerConflict: () => void;
  /** Re-renders the visible sync toast (e.g. after a locale switch). */
  refresh: () => void;
  dispose: () => void;
}

/**
 * Offline → reconnect → reconcile state machine that reports every phase
 * through the shared notification store under a single toast id:
 * offline (sticky warning) → reconciling (progress) → complete (success)
 * or conflict (auto-retry once) → failed (sticky error with a Retry action).
 */
export function createSyncStatusController(options: SyncStatusControllerOptions): SyncStatusController {
  const scheduler = options.scheduler ?? {
    setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
    clearTimeout: (handle: unknown) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
  const minSyncMs = options.minSyncMs ?? SYNC_HUD_DURATION_MS;
  const retryDelayMs = options.retryDelayMs ?? SYNC_HUD_CONFLICT_RETRY_MS;
  const syncedHoldMs = options.syncedHoldMs ?? SYNC_HUD_COMPLETE_HOLD_MS + 1000;

  let phase: SyncNotificationPhase = options.initiallyOffline ? 'offline' : 'idle';
  let wasOffline = Boolean(options.initiallyOffline);
  let generation = 0;
  let disposed = false;
  let lastError: string | null = null;
  const timers = new Set<unknown>();

  const schedule = (fn: () => void, ms: number) => {
    const handle = scheduler.setTimeout(() => {
      timers.delete(handle);
      fn();
    }, ms);
    timers.add(handle);
    return handle;
  };

  const clearTimers = () => {
    for (const handle of timers) scheduler.clearTimeout(handle);
    timers.clear();
  };

  const wait = (ms: number) => new Promise<void>((resolve) => schedule(resolve, ms));

  const render = () => {
    const copy = options.getCopy();
    const { store } = options;
    switch (phase) {
      case 'idle':
        return;
      case 'offline':
        store.notify({
          id: SYNC_NOTIFICATION_ID,
          tone: 'warning',
          title: copy.sync.offline,
          message: copy.sync.offlineMessage,
          durationMs: null,
        });
        return;
      case 'syncing':
        store.notify({
          id: SYNC_NOTIFICATION_ID,
          tone: 'progress',
          title: copy.sync.reconciling,
          durationMs: null,
          dismissible: false,
        });
        return;
      case 'synced':
        store.notify({
          id: SYNC_NOTIFICATION_ID,
          tone: 'success',
          title: copy.sync.synced,
          durationMs: syncedHoldMs,
        });
        return;
      case 'conflict':
        store.notify({
          id: SYNC_NOTIFICATION_ID,
          tone: 'error',
          title: copy.sync.conflict,
          message: lastError,
          durationMs: null,
          dismissible: false,
        });
        return;
      case 'failed':
        store.notify({
          id: SYNC_NOTIFICATION_ID,
          tone: 'error',
          title: copy.sync.failed,
          message: lastError ? `${copy.sync.failedMessage} (${lastError})` : copy.sync.failedMessage,
          durationMs: null,
          action: {
            label: copy.common.retry,
            onAction: () => {
              void controller.reconcileNow();
            },
          },
        });
        return;
    }
  };

  const setPhase = (next: SyncNotificationPhase) => {
    phase = next;
    render();
    options.onPhaseChange?.(next);
  };

  const enterConflict = (autoRetry: boolean) => {
    clearTimers();
    setPhase('conflict');
    if (autoRetry) {
      const gen = generation;
      schedule(() => {
        if (disposed || gen !== generation) return;
        void runReconcile(true);
      }, retryDelayMs);
    }
  };

  const runReconcile = async (isRetry: boolean): Promise<void> => {
    if (disposed) return;
    generation += 1;
    const gen = generation;
    clearTimers();
    lastError = null;
    setPhase('syncing');

    try {
      await Promise.all([Promise.resolve().then(() => options.reconcile?.()), wait(minSyncMs)]);
    } catch (err) {
      if (disposed || gen !== generation) return;
      lastError = describeError(err, options.getCopy().common.genericError);
      if (isRetry) {
        setPhase('failed');
      } else {
        enterConflict(true);
      }
      return;
    }

    if (disposed || gen !== generation) return;
    setPhase('synced');
    schedule(() => {
      if (disposed || gen !== generation) return;
      phase = 'idle';
      options.onPhaseChange?.('idle');
    }, syncedHoldMs);
  };

  const controller: SyncStatusController = {
    getPhase: () => phase,
    handleOffline: () => {
      const action = resolveNetworkTransition({ wasOffline, isNowOnline: false });
      wasOffline = true;
      if (action === 'enter_offline') {
        generation += 1;
        clearTimers();
        setPhase('offline');
      }
    },
    handleOnline: () => {
      const action = resolveNetworkTransition({ wasOffline, isNowOnline: true });
      wasOffline = false;
      if (action === 'start_sync') {
        void runReconcile(false);
      }
    },
    reconcileNow: () => {
      wasOffline = false;
      return runReconcile(false);
    },
    triggerConflict: () => {
      wasOffline = false;
      generation += 1;
      enterConflict(true);
    },
    refresh: () => {
      if (phase !== 'idle' && phase !== 'synced') render();
    },
    dispose: () => {
      disposed = true;
      clearTimers();
    },
  };

  return controller;
}
