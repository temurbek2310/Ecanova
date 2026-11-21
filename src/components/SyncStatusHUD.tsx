'use client';

import React, { useEffect, useRef } from 'react';
import type { LocaleCode } from '../shared/types';
import { notificationCopy } from '../lib/notification-copy';
import { notificationStore } from '../lib/notifications';
import { SYNC_HUD_CONFLICT_RETRY_MS, SYNC_HUD_DURATION_MS } from '../lib/node-unlock';
import { createSyncStatusController, type SyncStatusController } from '../lib/sync-notifications';

export interface SyncStatusHUDProps {
  locale: LocaleCode;
  /** Callback triggered when the network reconnects to reconcile persisted data. Reject to signal failure. */
  onReconcile?: () => Promise<void> | void;
  /** Minimum duration of the reconciliation phase in ms (defaults to 2000ms). */
  syncDurationMs?: number;
  /** Delay before the automatic retry after a conflict (defaults to 1300ms). */
  conflictRetryMs?: number;
}

export const SYNC_HUD_MANUAL_TRIGGER_EVENT = 'econova:trigger-reconcile-hud';
export const SYNC_HUD_CONFLICT_TRIGGER_EVENT = 'econova:trigger-reconcile-conflict';

export function dispatchSyncStatusReconcile(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_HUD_MANUAL_TRIGGER_EVENT));
}

export function dispatchSyncStatusConflict(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_HUD_CONFLICT_TRIGGER_EVENT));
}

/**
 * Headless offline/online reconciliation controller. It renders nothing itself:
 * every phase (offline, reconciling, complete, conflict/retry, failed) is
 * reported through the shared notification store and shown by
 * `<NotificationViewport />` in the bottom-right corner.
 */
export const SyncStatusHUD: React.FC<SyncStatusHUDProps> = ({
  locale,
  onReconcile,
  syncDurationMs = SYNC_HUD_DURATION_MS,
  conflictRetryMs = SYNC_HUD_CONFLICT_RETRY_MS,
}) => {
  const onReconcileRef = useRef(onReconcile);
  onReconcileRef.current = onReconcile;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const controllerRef = useRef<SyncStatusController | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const controller = createSyncStatusController({
      store: notificationStore,
      getCopy: () => notificationCopy(localeRef.current),
      reconcile: () => onReconcileRef.current?.(),
      minSyncMs: syncDurationMs,
      retryDelayMs: conflictRetryMs,
      initiallyOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
    });
    controllerRef.current = controller;
    controller.refresh();

    const handleOffline = () => controller.handleOffline();
    const handleOnline = () => controller.handleOnline();
    const handleManualSync = () => void controller.reconcileNow();
    const handleConflict = () => controller.triggerConflict();

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener(SYNC_HUD_MANUAL_TRIGGER_EVENT, handleManualSync);
    window.addEventListener(SYNC_HUD_CONFLICT_TRIGGER_EVENT, handleConflict);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(SYNC_HUD_MANUAL_TRIGGER_EVENT, handleManualSync);
      window.removeEventListener(SYNC_HUD_CONFLICT_TRIGGER_EVENT, handleConflict);
      controller.dispose();
      controllerRef.current = null;
    };
  }, [syncDurationMs, conflictRetryMs]);

  // Keep a visible sticky sync toast in the active language after a locale switch.
  useEffect(() => {
    controllerRef.current?.refresh();
  }, [locale]);

  return null;
};

export default SyncStatusHUD;
