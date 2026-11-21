'use client';

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import {
  createNotificationApi,
  createToastSlotReporter,
  type NotificationTone,
  notificationStore,
  notify,
  type NotificationApi,
  type NotificationRecord,
  type NotificationStore,
} from '../lib/notifications';

interface NotificationContextValue {
  store: NotificationStore;
  api: NotificationApi;
}

const defaultValue: NotificationContextValue = {
  store: notificationStore,
  api: notify,
};

const NotificationContext = createContext<NotificationContextValue>(defaultValue);

/**
 * Optional provider. Without it, components use the app-wide singleton store,
 * which is also what non-React modules (`notify` from lib/notifications) use.
 */
export const NotificationProvider: React.FC<{ store?: NotificationStore; children: React.ReactNode }> = ({
  store,
  children,
}) => {
  const value = useMemo<NotificationContextValue>(
    () => (store ? { store, api: createNotificationApi(store) } : defaultValue),
    [store]
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

/** Dispatcher for toasts: `notify.success(title, message)`, `notify.task(run, copy)`, … */
export function useNotify(): NotificationApi {
  return useContext(NotificationContext).api;
}

/** Live list of visible notifications plus pause/resume controls for the viewport. */
export function useNotificationRecords(): {
  records: readonly NotificationRecord[];
  store: NotificationStore;
} {
  const { store } = useContext(NotificationContext);
  const records = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { records, store };
}

/**
 * Hook form of `createToastSlotReporter`: returns a `(message | null) => void`
 * setter that routes feedback into one toast slot instead of an inline banner.
 */
export function useToastSlot(
  id: string,
  title: string,
  tone: NotificationTone = 'error'
): (message: string | null | undefined) => void {
  const api = useNotify();
  return useMemo(() => createToastSlotReporter(api, id, title, tone), [api, id, title, tone]);
}
