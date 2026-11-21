/**
 * Unified, framework-agnostic user notification store for ECONOVA.
 *
 * Every user-facing async action, background sync or task completion pushes
 * feedback through this single dispatcher. React components subscribe via
 * `useNotifications()` (src/context/NotificationContext.tsx) and the stack is
 * rendered once by `<NotificationViewport />`.
 *
 * The store owns timing (auto-dismiss, hover pause) so behaviour is identical
 * everywhere and can be unit-tested without a DOM.
 */

export type NotificationTone = 'info' | 'success' | 'warning' | 'error' | 'progress';

export interface NotificationAction {
  label: string;
  onAction: () => void;
}

export interface NotificationInput {
  /** Stable id. Re-using an id updates the existing toast in place (upsert). */
  id?: string;
  tone?: NotificationTone;
  title: string;
  message?: string | null;
  /** Auto-dismiss delay in ms. `null` keeps the toast until dismissed or updated. */
  durationMs?: number | null;
  /** Whether a manual close button is shown. Defaults to true. */
  dismissible?: boolean;
  action?: NotificationAction | null;
}

export interface NotificationRecord {
  id: string;
  tone: NotificationTone;
  title: string;
  message: string | null;
  durationMs: number | null;
  dismissible: boolean;
  action: NotificationAction | null;
  createdAt: number;
  updatedAt: number;
}

export type NotificationListener = () => void;

export interface NotificationScheduler {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
}

export interface NotificationStoreOptions {
  scheduler?: NotificationScheduler;
  maxVisible?: number;
}

export interface NotificationStore {
  getSnapshot: () => readonly NotificationRecord[];
  subscribe: (listener: NotificationListener) => () => void;
  notify: (input: NotificationInput) => string;
  update: (id: string, patch: Partial<Omit<NotificationInput, 'id'>>) => boolean;
  dismiss: (id: string) => void;
  clear: () => void;
  /** Pause the auto-dismiss countdown (e.g. while hovered or focused). */
  pause: (id: string) => void;
  /** Resume a paused countdown with the time that was remaining. */
  resume: (id: string) => void;
}

export const DEFAULT_NOTIFICATION_DURATIONS: Record<NotificationTone, number | null> = {
  info: 4000,
  success: 3500,
  warning: 6000,
  error: 8000,
  progress: null,
};

export const MAX_VISIBLE_NOTIFICATIONS = 4;

/** Shared id so every reconnect/progress-sync flow reuses a single toast slot. */
export const SYNC_NOTIFICATION_ID = 'econova:sync-status';

const defaultScheduler: NotificationScheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

interface TimerState {
  handle: unknown;
  startedAt: number;
  remainingMs: number;
  paused: boolean;
}

export function createNotificationStore(options: NotificationStoreOptions = {}): NotificationStore {
  const scheduler = options.scheduler ?? defaultScheduler;
  const maxVisible = Math.max(1, options.maxVisible ?? MAX_VISIBLE_NOTIFICATIONS);

  let records: readonly NotificationRecord[] = [];
  const listeners = new Set<NotificationListener>();
  const timers = new Map<string, TimerState>();
  let counter = 0;

  const emit = () => {
    for (const listener of Array.from(listeners)) listener();
  };

  const stopTimer = (id: string) => {
    const timer = timers.get(id);
    if (timer && timer.handle !== null) scheduler.clearTimeout(timer.handle);
    timers.delete(id);
  };

  const startTimer = (id: string, ms: number) => {
    stopTimer(id);
    const handle = scheduler.setTimeout(() => {
      timers.delete(id);
      removeRecord(id);
    }, ms);
    timers.set(id, { handle, startedAt: scheduler.now(), remainingMs: ms, paused: false });
  };

  const removeRecord = (id: string) => {
    const next = records.filter((r) => r.id !== id);
    if (next.length === records.length) return;
    records = next;
    emit();
  };

  const trimOverflow = () => {
    if (records.length <= maxVisible) return;
    const next = [...records];
    while (next.length > maxVisible) {
      // Prefer evicting the oldest auto-dismissing toast; keep sticky progress/sync toasts.
      let evictIdx = next.findIndex((r) => r.durationMs !== null);
      if (evictIdx === -1) evictIdx = 0;
      const [evicted] = next.splice(evictIdx, 1);
      if (evicted) stopTimer(evicted.id);
    }
    records = next;
  };

  const normalize = (
    input: NotificationInput,
    id: string,
    previous: NotificationRecord | undefined
  ): NotificationRecord => {
    const tone = input.tone ?? 'info';
    const now = scheduler.now();
    return {
      id,
      tone,
      title: input.title,
      message: input.message ?? null,
      durationMs:
        input.durationMs === undefined ? DEFAULT_NOTIFICATION_DURATIONS[tone] : input.durationMs,
      dismissible: input.dismissible ?? true,
      action: input.action ?? null,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const notify = (input: NotificationInput): string => {
    let id = input.id;
    if (!id) {
      // Collapse identical anonymous toasts instead of stacking duplicates.
      const duplicate = records.find(
        (r) =>
          r.id.startsWith('n-') &&
          r.title === input.title &&
          r.message === (input.message ?? null) &&
          r.tone === (input.tone ?? 'info')
      );
      id = duplicate?.id ?? `n-${scheduler.now().toString(36)}-${(counter += 1)}`;
    }

    const existingIdx = records.findIndex((r) => r.id === id);
    const record = normalize(input, id, existingIdx >= 0 ? records[existingIdx] : undefined);

    if (existingIdx >= 0) {
      const next = [...records];
      // Move updated toasts to the newest position so the latest state is closest to the edge.
      next.splice(existingIdx, 1);
      next.push(record);
      records = next;
    } else {
      records = [...records, record];
    }
    trimOverflow();

    if (record.durationMs !== null && record.durationMs > 0) {
      startTimer(id, record.durationMs);
    } else {
      stopTimer(id);
    }
    emit();
    return id;
  };

  const update: NotificationStore['update'] = (id, patch) => {
    const current = records.find((r) => r.id === id);
    if (!current) return false;
    notify({
      id,
      tone: patch.tone ?? current.tone,
      title: patch.title ?? current.title,
      message: patch.message !== undefined ? patch.message : current.message,
      durationMs:
        patch.durationMs !== undefined
          ? patch.durationMs
          : patch.tone && patch.tone !== current.tone
          ? undefined
          : current.durationMs,
      dismissible: patch.dismissible ?? current.dismissible,
      action: patch.action !== undefined ? patch.action : current.action,
    });
    return true;
  };

  const dismiss = (id: string) => {
    stopTimer(id);
    removeRecord(id);
  };

  const clear = () => {
    for (const id of Array.from(timers.keys())) stopTimer(id);
    if (records.length === 0) return;
    records = [];
    emit();
  };

  const pause = (id: string) => {
    const timer = timers.get(id);
    if (!timer || timer.paused) return;
    scheduler.clearTimeout(timer.handle);
    const elapsed = scheduler.now() - timer.startedAt;
    timers.set(id, {
      handle: null,
      startedAt: timer.startedAt,
      remainingMs: Math.max(0, timer.remainingMs - elapsed),
      paused: true,
    });
  };

  const resume = (id: string) => {
    const timer = timers.get(id);
    if (!timer || !timer.paused) return;
    // Give the reader a short grace period after the pointer leaves.
    startTimer(id, Math.max(timer.remainingMs, 1200));
  };

  return {
    getSnapshot: () => records,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify,
    update,
    dismiss,
    clear,
    pause,
    resume,
  };
}

/** Extracts a human-readable reason from an unknown thrown value. */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

export interface TaskNotificationCopy<T> {
  id?: string;
  pending?: { title: string; message?: string | null };
  success: { title: string; message?: string | null } | ((result: T) => { title: string; message?: string | null });
  error: { title: string; fallback: string };
}

export interface NotificationApi {
  show: (input: NotificationInput) => string;
  info: (title: string, message?: string | null, extra?: Partial<NotificationInput>) => string;
  success: (title: string, message?: string | null, extra?: Partial<NotificationInput>) => string;
  warning: (title: string, message?: string | null, extra?: Partial<NotificationInput>) => string;
  error: (title: string, message?: string | null, extra?: Partial<NotificationInput>) => string;
  progress: (title: string, message?: string | null, extra?: Partial<NotificationInput>) => string;
  update: NotificationStore['update'];
  dismiss: NotificationStore['dismiss'];
  clear: NotificationStore['clear'];
  /**
   * Runs an async task with consistent progress → success / error feedback.
   * Errors are surfaced as a toast and re-thrown so callers can still react.
   */
  task: <T>(run: () => Promise<T>, copy: TaskNotificationCopy<T>) => Promise<T>;
}

export function createNotificationApi(store: NotificationStore): NotificationApi {
  const byTone =
    (tone: NotificationTone) =>
    (title: string, message?: string | null, extra?: Partial<NotificationInput>) =>
      store.notify({ ...extra, tone, title, message: message ?? null });

  const task: NotificationApi['task'] = async (run, copy) => {
    const id =
      copy.id ?? (copy.pending ? `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` : undefined);
    if (copy.pending && id) {
      store.notify({ id, tone: 'progress', title: copy.pending.title, message: copy.pending.message ?? null, dismissible: false });
    }
    try {
      const result = await run();
      const success = typeof copy.success === 'function' ? copy.success(result) : copy.success;
      store.notify({ id, tone: 'success', title: success.title, message: success.message ?? null });
      return result;
    } catch (err) {
      store.notify({
        id,
        tone: 'error',
        title: copy.error.title,
        message: describeError(err, copy.error.fallback),
      });
      throw err;
    }
  };

  return {
    show: (input) => store.notify(input),
    info: byTone('info'),
    success: byTone('success'),
    warning: byTone('warning'),
    error: byTone('error'),
    progress: (title, message, extra) =>
      store.notify({ dismissible: false, ...extra, tone: 'progress', title, message: message ?? null }),
    update: store.update,
    dismiss: store.dismiss,
    clear: store.clear,
    task,
  };
}

/** App-wide singleton store; usable from both React components and plain modules. */
export const notificationStore: NotificationStore = createNotificationStore();

/** App-wide notification dispatcher bound to the singleton store. */
export const notify: NotificationApi = createNotificationApi(notificationStore);

export interface PresenceItem {
  record: NotificationRecord;
  leaving: boolean;
}

/**
 * Merges the live notification list with what is currently rendered so that
 * removed toasts can play an exit animation before unmounting. Order follows
 * the live list, with leaving items kept at their previous positions.
 */
export function reconcilePresence(
  rendered: readonly PresenceItem[],
  live: readonly NotificationRecord[]
): PresenceItem[] {
  const liveById = new Map(live.map((r) => [r.id, r]));
  const result: PresenceItem[] = [];
  const seen = new Set<string>();

  for (const item of rendered) {
    const fresh = liveById.get(item.record.id);
    if (fresh) continue; // re-inserted below in live order
    result.push({ record: item.record, leaving: true });
    seen.add(item.record.id);
  }

  for (const record of live) {
    if (seen.has(record.id)) continue;
    result.push({ record, leaving: false });
  }
  return result;
}

/**
 * Drop-in replacement for an inline `setErrorMsg(message | null)` state setter:
 * a message shows (or updates) a single toast slot, `null` clears it.
 */
export function createToastSlotReporter(
  api: Pick<NotificationApi, 'show' | 'dismiss'>,
  id: string,
  title: string,
  tone: NotificationTone = 'error'
): (message: string | null | undefined) => void {
  return (message) => {
    if (message && message.trim()) {
      api.show({ id, tone, title, message });
    } else {
      api.dismiss(id);
    }
  };
}
