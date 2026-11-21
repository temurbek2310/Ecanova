import React from 'react';
import { Loader2 } from 'lucide-react';

export interface RouteAccessPendingProps {
  title: string;
  hint?: string;
}

/**
 * Neutral placeholder shown on session-dependent routes while the initial
 * /api/auth/me check is in flight, so neither protected content nor a
 * premature login redirect appears before the session is known.
 */
export function RouteAccessPending({ title, hint }: RouteAccessPendingProps) {
  return (
    <div
      aria-busy="true"
      data-testid="route-access-pending"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center"
    >
      <Loader2
        className="h-7 w-7 animate-spin text-slate-500 dark:text-slate-400"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}
