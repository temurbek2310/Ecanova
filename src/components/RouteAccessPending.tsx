import React from 'react';
import { Loader2 } from 'lucide-react';
import { SkeletonLine } from './ui/BrutalSkeleton';

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
      className="flex min-h-[50vh] flex-col items-center justify-center p-4 text-center"
    >
      <div className="admin-surface flex max-w-sm w-full flex-col items-center justify-center p-6 sm:p-8 space-y-4">
        <Loader2
          className="h-6 w-6 animate-spin text-muted"
          aria-hidden="true"
        />
        <div className="space-y-1 w-full">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {hint ? <p className="text-xs text-muted">{hint}</p> : null}
        </div>
        <SkeletonLine admin width="60%" height="8px" className="rounded-full mt-2" />
      </div>
    </div>
  );
}
