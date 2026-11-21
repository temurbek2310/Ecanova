'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { LocaleCode } from '../shared/types';
import { useNotificationRecords } from '../context/NotificationContext';
import { notificationCopy } from '../lib/notification-copy';
import {
  reconcilePresence,
  type NotificationTone,
  type PresenceItem,
} from '../lib/notifications';

const EXIT_ANIMATION_MS = 200;

/** Telemetry HUD palette, shared with the original sync status toast. */
const TONE_STYLES: Record<NotificationTone, { border: string; text: string; dot: string }> = {
  progress: { border: 'border-[#5DE1D2]', text: 'text-[#5DE1D2]', dot: 'bg-[#5DE1D2] animate-pulse' },
  success: { border: 'border-[#6FE0A1]', text: 'text-[#6FE0A1]', dot: 'bg-[#6FE0A1]' },
  warning: { border: 'border-[#FFC96B]', text: 'text-[#FFC96B]', dot: 'bg-[#FFC96B]' },
  error: { border: 'border-[#FF4D4D]', text: 'text-[#FF4D4D]', dot: 'bg-[#FF4D4D]' },
  info: { border: 'border-[#9274FF]', text: 'text-[#B9A6FF]', dot: 'bg-[#9274FF]' },
};

export interface NotificationViewportProps {
  locale: LocaleCode;
}

/**
 * Renders the single app-wide toast stack in the bottom-right corner.
 * Sits above the mobile bottom navigation, lets clicks pass through the gaps
 * between toasts, pauses auto-dismiss on hover/focus, and supports manual close.
 */
export const NotificationViewport: React.FC<NotificationViewportProps> = ({ locale }) => {
  const { records, store } = useNotificationRecords();
  const copy = notificationCopy(locale);
  const [items, setItems] = useState<PresenceItem[]>(() => reconcilePresence([], records));
  const exitTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setItems((prev) => reconcilePresence(prev, records));
  }, [records]);

  // Unmount leaving items once their exit animation has played.
  useEffect(() => {
    const timers = exitTimersRef.current;
    for (const item of items) {
      if (!item.leaving) {
        const pending = timers.get(item.record.id);
        if (pending !== undefined) {
          window.clearTimeout(pending);
          timers.delete(item.record.id);
        }
        continue;
      }
      if (timers.has(item.record.id)) continue;
      const id = item.record.id;
      timers.set(
        id,
        window.setTimeout(() => {
          timers.delete(id);
          setItems((prev) => prev.filter((p) => !(p.leaving && p.record.id === id)));
        }, EXIT_ANIMATION_MS)
      );
    }
  }, [items]);

  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      for (const handle of timers.values()) window.clearTimeout(handle);
      timers.clear();
    };
  }, []);

  return (
    <section
      aria-label={copy.common.regionLabel}
      data-testid="notification-viewport"
      className="no-print pointer-events-none fixed bottom-[4.5rem] right-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-2 md:bottom-4"
    >
      <div aria-live="polite" aria-relevant="additions text" className="contents">
        {items.map(({ record, leaving }) => {
          const tone = TONE_STYLES[record.tone];
          const isAlert = record.tone === 'error';
          return (
            <div
              key={record.id}
              role={isAlert ? 'alert' : 'status'}
              data-testid="notification-toast"
              data-notification-id={record.id}
              data-notification-tone={record.tone}
              onMouseEnter={() => store.pause(record.id)}
              onMouseLeave={() => store.resume(record.id)}
              onFocus={() => store.pause(record.id)}
              onBlur={() => store.resume(record.id)}
              className={`pointer-events-auto flex w-full items-start gap-3 border-2 bg-[#101522] px-4 py-3 font-mono text-xs shadow-[6px_6px_0px_#000000] ${
                tone.border
              } ${tone.text} ${leaving ? 'animate-toast-out' : 'animate-toast-in'}`}
            >
              <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 ${tone.dot}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="break-words font-bold tracking-wider">{record.title}</p>
                {record.message && (
                  <p className="mt-1 break-words font-sans text-[11px] font-medium leading-snug text-[#C9D2E3]">
                    {record.message}
                  </p>
                )}
                {record.action && (
                  <button
                    type="button"
                    onClick={() => {
                      record.action?.onAction();
                      store.dismiss(record.id);
                    }}
                    className={`mt-2 border px-2 py-1 text-[11px] font-bold uppercase tracking-wider hover:bg-white/5 ${tone.border}`}
                  >
                    {record.action.label}
                  </button>
                )}
              </div>
              {record.dismissible && (
                <button
                  type="button"
                  onClick={() => store.dismiss(record.id)}
                  aria-label={copy.common.dismiss}
                  title={copy.common.dismiss}
                  className="-mr-1 -mt-0.5 shrink-0 p-1 text-[#8A94A8] hover:text-white focus-visible:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default NotificationViewport;
