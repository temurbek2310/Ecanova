import React from 'react';
import { RefreshCw } from 'lucide-react';
import { InteractiveDotGrid } from './InteractiveDotGrid';

export interface DataStateCardProps {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  testId?: string;
  className?: string;
  /** "compact" drops the dot grid + shadow for use inside an existing card. */
  variant?: 'card' | 'compact';
}

/**
 * Glass-brutalist error / empty state. No `isolate`, transforms or opacity
 * wrappers (keeps backdrop-filter intact) and no inline alert/status roles —
 * failures are announced through the notification viewport instead.
 */
export const DataStateCard: React.FC<DataStateCardProps> = ({
  title,
  body,
  icon,
  retryLabel,
  onRetry,
  testId,
  className = '',
  variant = 'card',
}) => {
  const isCard = variant === 'card';
  return (
    <div
      data-testid={testId}
      className={`relative overflow-hidden rounded-xl border-2 border-slate-500 p-6 text-center dark:border-[#222B3D] ${
        isCard
          ? 'bg-white/25 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:bg-[#101522]/25'
          : 'bg-white/45 dark:bg-[#080B14]/50'
      } ${className}`.trim()}
    >
      {isCard && <InteractiveDotGrid testId={testId ? `${testId}-dot-grid` : undefined} />}
      <div className="relative z-10 flex flex-col items-center gap-2">
        {icon && <div className="text-theme-accent">{icon}</div>}
        <p className="text-sm font-bold text-ink">{title}</p>
        {body && <p className="max-w-md text-xs leading-relaxed text-slate-700 dark:text-slate-300">{body}</p>}
        {onRetry && retryLabel && (
          <button
            type="button"
            onClick={onRetry}
            data-testid={testId ? `${testId}-retry` : undefined}
            className="mt-2 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border-2 border-slate-500 bg-white/55 px-4 py-1.5 text-xs font-bold text-ink shadow-brutal-sm transition-colors hover:border-slate-900 hover:bg-slate-900/10 hover:text-slate-950 dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:hover:border-theme-accent dark:hover:text-ink"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
};
