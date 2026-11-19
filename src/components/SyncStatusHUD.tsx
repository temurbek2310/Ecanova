'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import {
  SYNC_HUD_COMPLETE_HOLD_MS,
  SYNC_HUD_CONFLICT_RETRY_MS,
  SYNC_HUD_DURATION_MS,
  SYNC_HUD_MESSAGES,
  resolveNetworkTransition,
  type SyncStatusPhase,
} from '../lib/node-unlock';

export interface SyncStatusHUDProps {
  /** Optional callback triggered when network reconnects to reconcile persisted data. */
  onReconcile?: () => Promise<void> | void;
  /** Duration of simulated reconciliation phase in ms (defaults to 2000ms). */
  syncDurationMs?: number;
  /** Duration to hold conflict state before automatic retry (defaults to 1300ms). */
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

export const SyncStatusHUD: React.FC<SyncStatusHUDProps> = ({
  onReconcile,
  syncDurationMs = SYNC_HUD_DURATION_MS,
  conflictRetryMs = SYNC_HUD_CONFLICT_RETRY_MS,
}) => {
  const [phase, setPhase] = useState<SyncStatusPhase>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'idle'
  );
  const wasOfflineRef = useRef<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const conflictTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const onReconcileRef = useRef(onReconcile);
  onReconcileRef.current = onReconcile;

  const clearTimers = useCallback(() => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (conflictTimerRef.current !== null) {
      window.clearTimeout(conflictTimerRef.current);
      conflictTimerRef.current = null;
    }
  }, []);

  const beginReconciliationRef = useRef<(options?: { isRetry?: boolean }) => void>(() => {});

  const enterConflictState = useCallback(
    (canAutoRetry: boolean = true) => {
      clearTimers();
      if (!isMountedRef.current) return;
      setPhase('conflict');

      if (canAutoRetry) {
        conflictTimerRef.current = window.setTimeout(() => {
          if (!isMountedRef.current) return;
          beginReconciliationRef.current({ isRetry: true });
        }, conflictRetryMs);
      }
    },
    [clearTimers, conflictRetryMs]
  );

  const beginReconciliation = useCallback(
    (options?: { isRetry?: boolean }) => {
      clearTimers();
      if (!isMountedRef.current) return;
      setPhase('syncing');

      let failedSync = false;

      const scheduleCompletion = () => {
        if (!isMountedRef.current || failedSync) return;
        syncTimerRef.current = window.setTimeout(() => {
          if (!isMountedRef.current || failedSync) return;
          setPhase('synced');
          holdTimerRef.current = window.setTimeout(() => {
            if (!isMountedRef.current) return;
            setPhase('exiting');
          }, SYNC_HUD_COMPLETE_HOLD_MS);
        }, syncDurationMs);
      };

      try {
        const result = onReconcileRef.current?.();
        if (result && typeof (result as Promise<void>).then === 'function') {
          void (result as Promise<void>).then(
            () => {
              // Reconciliation succeeded; completion timer handles transition cleanly
            },
            () => {
              failedSync = true;
              enterConflictState(!options?.isRetry);
            }
          );
        }
      } catch {
        failedSync = true;
        enterConflictState(!options?.isRetry);
        return;
      }

      scheduleCompletion();
    },
    [clearTimers, enterConflictState, syncDurationMs]
  );

  beginReconciliationRef.current = beginReconciliation;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOffline = () => {
      const action = resolveNetworkTransition({
        wasOffline: wasOfflineRef.current,
        isNowOnline: false,
      });
      wasOfflineRef.current = true;
      if (action === 'enter_offline') {
        clearTimers();
        setPhase('offline');
      }
    };

    const handleOnline = () => {
      const action = resolveNetworkTransition({
        wasOffline: wasOfflineRef.current,
        isNowOnline: true,
      });
      wasOfflineRef.current = false;
      if (action === 'start_sync') {
        beginReconciliation();
      }
    };

    const handleManualSync = () => {
      wasOfflineRef.current = false;
      beginReconciliation();
    };

    const handleConflictTrigger = () => {
      wasOfflineRef.current = false;
      enterConflictState(true);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener(SYNC_HUD_MANUAL_TRIGGER_EVENT, handleManualSync);
    window.addEventListener(SYNC_HUD_CONFLICT_TRIGGER_EVENT, handleConflictTrigger);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(SYNC_HUD_MANUAL_TRIGGER_EVENT, handleManualSync);
      window.removeEventListener(SYNC_HUD_CONFLICT_TRIGGER_EVENT, handleConflictTrigger);
      clearTimers();
    };
  }, [beginReconciliation, clearTimers, enterConflictState]);

  // Smooth GSAP entrance, mechanical conflict recoil, and exit slide anchored strictly to containerRef
  useEconovaGSAP(
    containerRef,
    () => {
      const el = containerRef.current;
      if (!el) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (phase === 'idle') {
        gsap.set(el, { autoAlpha: 0, x: 40 });
        return;
      }

      if (phase === 'offline' || phase === 'syncing') {
        if (prefersReducedMotion) {
          gsap.set(el, { autoAlpha: 1, x: 0 });
          return;
        }
        gsap.fromTo(
          el,
          { x: 64, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: 0.35, ease: 'power4.out', overwrite: 'auto' }
        );
        return;
      }

      if (phase === 'conflict') {
        if (prefersReducedMotion) {
          gsap.set(el, { autoAlpha: 1, x: 0 });
          return;
        }
        gsap.fromTo(
          el,
          { autoAlpha: 1, x: 0 },
          {
            keyframes: [
              { x: -6 },
              { x: 6 },
              { x: -4 },
              { x: 4 },
              { x: -2 },
              { x: 2 },
              { x: 0 },
            ],
            duration: 0.4,
            ease: 'power2.out',
            overwrite: 'auto',
          }
        );
        return;
      }

      if (phase === 'synced') {
        if (prefersReducedMotion) {
          gsap.set(el, { autoAlpha: 1, x: 0, scale: 1 });
          return;
        }
        gsap.fromTo(
          el,
          { autoAlpha: 1, x: 0, scale: 1.03 },
          { scale: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' }
        );
        return;
      }

      if (phase === 'exiting') {
        if (prefersReducedMotion) {
          setPhase('idle');
          return;
        }
        gsap.to(el, {
          x: 160,
          autoAlpha: 0,
          duration: 0.45,
          ease: 'power4.in',
          overwrite: 'auto',
          onComplete: () => {
            setPhase('idle');
          },
        });
      }
    },
    { dependencies: [phase] }
  );

  const isVisible = phase !== 'idle';
  const isSynced = phase === 'synced' || phase === 'exiting';
  const isConflict = phase === 'conflict';
  const isOffline = phase === 'offline';

  const borderClass = isConflict
    ? 'border-[#FF4D4D]'
    : isSynced
    ? 'border-[#6FE0A1]'
    : isOffline
    ? 'border-[#FFC96B]'
    : 'border-[#5DE1D2]';

  const textClass = isConflict
    ? 'text-[#FF4D4D]'
    : isSynced
    ? 'text-[#6FE0A1]'
    : isOffline
    ? 'text-[#FFC96B]'
    : 'text-[#5DE1D2]';

  const dotClass = isConflict
    ? 'bg-[#FF4D4D]'
    : isSynced
    ? 'bg-[#6FE0A1]'
    : isOffline
    ? 'bg-[#FFC96B]'
    : 'bg-[#5DE1D2]';

  const statusText = isConflict
    ? SYNC_HUD_MESSAGES.conflict
    : isSynced
    ? SYNC_HUD_MESSAGES.synced
    : isOffline
    ? SYNC_HUD_MESSAGES.offline
    : SYNC_HUD_MESSAGES.syncing;

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      aria-hidden={!isVisible}
      data-testid="sync-status-hud"
      data-sync-phase={phase}
      style={{
        ...(!isVisible ? { visibility: 'hidden', pointerEvents: 'none' } : undefined),
        ...(isConflict ? { borderColor: '#FF4D4D', color: '#FF4D4D' } : undefined),
      }}
      className={`no-print fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 border-2 bg-[#101522] px-4 py-3 font-mono text-xs font-bold tracking-wider shadow-[8px_8px_0px_#000000] ${
        isConflict ? 'transition-none' : 'transition-colors'
      } ${borderClass} ${textClass}`}
    >
      <span className={`inline-block h-2.5 w-2.5 shrink-0 ${dotClass}`} aria-hidden="true" />
      <span className="truncate">{statusText}</span>
    </div>
  );
};

export default SyncStatusHUD;
