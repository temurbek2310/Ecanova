import type { NotificationScheduler } from './notifications';

/** Deterministic manual clock for notification/sync tests. */
export function createFakeScheduler(): NotificationScheduler & {
  advance: (ms: number) => void;
  pendingCount: () => number;
} {
  let now = 1_000;
  let nextId = 1;
  const tasks = new Map<number, { at: number; fn: () => void }>();

  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      let nextTask: [number, { at: number; fn: () => void }] | null = null;
      for (const entry of tasks) {
        if (entry[1].at <= target && (!nextTask || entry[1].at < nextTask[1].at)) nextTask = entry;
      }
      if (!nextTask) break;
      tasks.delete(nextTask[0]);
      now = nextTask[1].at;
      nextTask[1].fn();
    }
    now = target;
  };

  return {
    setTimeout: (fn, ms) => {
      const id = nextId++;
      tasks.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (handle) => {
      tasks.delete(handle as number);
    },
    now: () => now,
    advance,
    pendingCount: () => tasks.size,
  };
}

/** Lets queued promise callbacks run. */
export async function flushMicrotasks(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await Promise.resolve();
}
