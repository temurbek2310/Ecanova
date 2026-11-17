import React from 'react';
import { Award, CheckCircle2, Flame, Sparkles, X } from 'lucide-react';
import type { MilestoneCelebrationEvent } from '../lib/celebrations';
import { GeometricNova } from './GeometricNova';

interface MilestoneCelebrationProps {
  event: MilestoneCelebrationEvent | null;
  onDismiss: () => void;
}

export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({
  event,
  onDismiss,
}) => {
  if (!event) return null;

  const icon =
    event.kind === 'course_completed' ? (
      <Award className="h-5 w-5 text-success" aria-hidden="true" />
    ) : event.kind === 'streak_reached' ? (
      <Flame className="h-5 w-5 text-teal" aria-hidden="true" />
    ) : event.kind === 'daily_goal_reached' ? (
      <CheckCircle2 className="h-5 w-5 text-accent" aria-hidden="true" />
    ) : (
      <Sparkles className="h-5 w-5 text-warning" aria-hidden="true" />
    );

  const borderTone =
    event.accentTone === 'success'
      ? 'border-success/60'
      : event.accentTone === 'teal'
      ? 'border-teal/60'
      : event.accentTone === 'accent'
      ? 'border-accent/60'
      : 'border-warning/60';

  return (
    <>
      <GeometricNova active={true} triggerKey={event.id} shardCount={28} />

      {/* Scaling milestone celebration card */}
      <div
        role="status"
        aria-live="polite"
        data-testid="milestone-celebration-banner"
        data-milestone-kind={event.kind}
        className="no-print fixed bottom-20 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm md:bottom-6 md:right-6"
      >
        <div
          className={`animate-milestone-pop flex items-start gap-3 rounded-xl border bg-surface/95 p-4 shadow-xl backdrop-blur-md ${borderTone}`}
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-ink">{event.title}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{event.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss celebration"
            className="shrink-0 rounded-lg p-1 text-muted hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
};
