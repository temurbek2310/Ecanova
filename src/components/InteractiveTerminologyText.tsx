import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, Sparkles, X } from 'lucide-react';
import type { GlossaryTermItem, KeyTerm, LocaleCode } from '../shared/types';
import { segmentTextWithGlossaryTerms } from '../lib/study-features';

interface InteractiveTerminologyTextProps {
  text: string;
  terms: readonly (KeyTerm | GlossaryTermItem)[];
  locale: LocaleCode;
  courseTitle?: string;
  className?: string;
}

export const InteractiveTerminologyText: React.FC<InteractiveTerminologyTextProps> = ({
  text,
  terms,
  locale,
  courseTitle,
  className = '',
}) => {
  const [activeTerm, setActiveTerm] = useState<GlossaryTermItem | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const segments = useMemo(() => segmentTextWithGlossaryTerms(text, terms), [text, terms]);

  useEffect(() => {
    if (!activeTerm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTerm(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTerm]);

  return (
    <div ref={containerRef} className="relative">
      <p className={className}>
        {segments.map((seg, idx) => {
          if (seg.kind === 'text') {
            return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
          }
          const isSelected =
            activeTerm?.term.toLowerCase() === seg.termItem.term.toLowerCase();
          return (
            <button
              key={idx}
              type="button"
              onClick={() =>
                setActiveTerm((prev) =>
                  prev?.term.toLowerCase() === seg.termItem.term.toLowerCase()
                    ? null
                    : seg.termItem
                )
              }
              data-testid="interactive-term-trigger"
              data-term={seg.termItem.term}
              aria-expanded={isSelected}
              title={
                locale === 'uz'
                  ? `${seg.termItem.term} atamasi ta’rifini ko‘rish`
                  : `Click to view definition of ${seg.termItem.term}`
              }
              className={`inline cursor-pointer rounded-xs border-b-2 border-dashed px-1 py-0.5 font-semibold transition-colors ${
                isSelected
                  ? 'border-theme-accent bg-theme-accent/25 text-ink'
                  : 'border-theme-cyan bg-theme-cyan/10 text-theme-cyan hover:bg-theme-cyan/20'
              }`}
            >
              {seg.text}
            </button>
          );
        })}
      </p>

      {activeTerm && (
        <div
          role="dialog"
          aria-label={`Glossary definition: ${activeTerm.term}`}
          data-testid="interactive-term-popover"
          className="no-print mt-2.5 rounded-xl border-2 border-theme-border bg-theme-base p-4 text-ink shadow-brutal"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-theme-border bg-theme-accent/20 text-theme-accent">
                <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">{activeTerm.term}</span>
                  <span className="inline-flex items-center gap-1 rounded border border-theme-border bg-theme-panel px-1.5 py-0.5 font-mono text-[10px] font-semibold text-theme-cyan">
                    <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                    <span>
                      {activeTerm.subject ||
                        (locale === 'uz' ? 'Kurs glossariysi' : 'Course Glossary')}
                    </span>
                  </span>
                </div>
                {(activeTerm.lessonTitle || courseTitle) && (
                  <div className="text-[11px] text-muted">
                    {activeTerm.lessonTitle || courseTitle}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTerm(null)}
              aria-label={locale === 'uz' ? 'Ta’rifni yopish' : 'Close definition overlay'}
              data-testid="interactive-term-close"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-theme-border bg-theme-panel text-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-ink/90">{activeTerm.definition}</p>
        </div>
      )}
    </div>
  );
};
