'use client';

import React, { useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Calendar, CheckCircle2, Filter, Terminal } from 'lucide-react';
import type { CourseCatalogItem, LocaleCode, QuizLeaderboardEntry, Subject } from '../shared/types';
import {
  filterQuizLeaderboardEntriesByCourse,
  formatWeekWindowLabel,
  getCurrentWeekWindow,
  summarizeQuizLeaderboard,
  type WeekWindow,
} from '../lib/quiz-leaderboard';
import { buildRankingMatrixRows } from '../lib/ranking-matrix';

gsap.registerPlugin(useGSAP);

export interface RankingMatrixProps {
  locale: LocaleCode;
  quizEntries: QuizLeaderboardEntry[];
  weekWindow?: WeekWindow | null;
  courses?: CourseCatalogItem[];
  selectedCourseId: string;
  onSelectCourseId: (courseId: string) => void;
}

function getTrackAccentClass(subject: Subject): string {
  switch (subject) {
    case 'Economics':
      return 'text-[#0F766E] dark:text-[#5DE1D2]';
    case 'Mathematics':
      return 'text-[#5B21B6] dark:text-[#9274FF]';
    case 'Business':
      return 'text-[#047857] dark:text-[#6FE0A1]';
  }
}

export const RankingMatrix: React.FC<RankingMatrixProps> = ({
  locale,
  quizEntries,
  weekWindow,
  courses = [],
  selectedCourseId,
  onSelectCourseId,
}) => {
  const isUz = locale === 'uz';
  const containerRef = useRef<HTMLDivElement | null>(null);

  const effectiveWeekWindow = useMemo(
    () => weekWindow ?? getCurrentWeekWindow(),
    [weekWindow]
  );

  const weekLabel = useMemo(
    () =>
      formatWeekWindowLabel(
        effectiveWeekWindow.weekStartIso,
        effectiveWeekWindow.weekEndIso,
        locale
      ),
    [effectiveWeekWindow, locale]
  );

  const courseFilterOptions = useMemo(() => {
    const map = new Map<string, { id: string; title: string; subject: Subject }>();
    for (const c of courses) {
      const ed = c.editions[locale] || c.editions.en || c.editions.uz;
      if (ed) {
        map.set(c.id, { id: c.id, title: ed.title, subject: c.subject });
      }
    }
    for (const q of quizEntries) {
      if (!map.has(q.courseId)) {
        map.set(q.courseId, { id: q.courseId, title: q.courseTitle, subject: q.subject });
      }
    }
    return Array.from(map.values());
  }, [courses, quizEntries, locale]);

  const filteredEntries = useMemo(
    () => filterQuizLeaderboardEntriesByCourse(quizEntries, selectedCourseId),
    [quizEntries, selectedCourseId]
  );

  const summary = useMemo(
    () => summarizeQuizLeaderboard(filteredEntries),
    [filteredEntries]
  );

  const matrixRows = useMemo(
    () => buildRankingMatrixRows(filteredEntries, locale),
    [filteredEntries, locale]
  );

  // Tactile GSAP stagger entrance on tab mount & filter changes
  useGSAP(
    () => {
      if (!containerRef.current) return;
      const container = containerRef.current;

      const rowElements = gsap.utils.toArray<HTMLElement>('[data-matrix-row]', container);
      if (rowElements.length === 0) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        gsap.set(rowElements, { opacity: 1, x: 0, y: 0 });
        return;
      }

      gsap.fromTo(
        rowElements,
        { opacity: 0, x: -24, y: 8 },
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.42,
          stagger: 0.045,
          ease: 'power4.out',
          clearProps: 'transform,opacity',
        }
      );
    },
    { scope: containerRef, dependencies: [selectedCourseId, matrixRows.length], revertOnUpdate: true }
  );

  return (
    <div
      ref={containerRef}
      role="tabpanel"
      data-testid="ranking-matrix-panel"
      className="mt-5 space-y-4"
    >
      {/* Quantitative Summary Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border-2 border-slate-500 bg-white/40 p-3.5 shadow-[6px_6px_0px_#090D16] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40 dark:shadow-[6px_6px_0px_#000000]">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
            <Calendar className="h-3.5 w-3.5 text-theme-cyan" aria-hidden="true" />
            <span>{isUz ? 'Haftalik oyna' : 'Evaluation Window'}</span>
          </div>
          <div
            data-testid="ranking-matrix-week-label"
            className="mt-1.5 font-mono text-sm font-bold tabular-nums text-ink"
          >
            {weekLabel}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {isUz ? 'Oxirgi 7 kunlik tekshiruv' : 'Rolling 7-day verification'}
          </div>
        </div>

        <div className="rounded-xl border-2 border-slate-500 bg-white/40 p-3.5 shadow-[6px_6px_0px_#090D16] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40 dark:shadow-[6px_6px_0px_#000000]">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
            {isUz ? 'Maksimal aniqlik' : 'Peak Accuracy'}
          </div>
          <div
            data-testid="ranking-matrix-top-score"
            className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#047857] dark:text-[#6FE0A1]"
          >
            {summary.topScorePercent.toFixed(1)}%
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {isUz ? 'Tasdiqlangan eng yuqori ball' : 'Highest verified quiz score'}
          </div>
        </div>

        <div className="rounded-xl border-2 border-slate-500 bg-white/40 p-3.5 shadow-[6px_6px_0px_#090D16] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40 dark:shadow-[6px_6px_0px_#000000]">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
            {isUz ? 'Kohorta o‘rtacha' : 'Cohort Mean · Pass'}
          </div>
          <div className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#0F766E] dark:text-[#5DE1D2]">
            {summary.averageScorePercent.toFixed(1)}%
          </div>
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted">
            {isUz ? 'O‘tish ulushi:' : 'Pass rate:'} {summary.passRatePercent}%
          </div>
        </div>

        <div className="rounded-xl border-2 border-slate-500 bg-white/40 p-3.5 shadow-[6px_6px_0px_#090D16] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40 dark:shadow-[6px_6px_0px_#000000]">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
            {isUz ? 'Matritsa qatorlari' : 'Matrix Records'}
          </div>
          <div className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#5B21B6] dark:text-[#9274FF]">
            {String(summary.participantCount).padStart(2, '0')}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {isUz ? 'Ixtiyoriy taxalluslar kesimida' : 'Opt-in cohort assessments'}
          </div>
        </div>
      </div>

      {/* Course Assessment Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-slate-500 bg-white/40 p-3 backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Filter className="h-3.5 w-3.5 text-[#5B21B6] dark:text-[#9274FF]" aria-hidden="true" />
          <span>{isUz ? 'Kurs kesimi:' : 'Assessment Filter:'}</span>
        </span>

        <button
          type="button"
          onClick={() => onSelectCourseId('all')}
          data-testid="ranking-matrix-filter-all"
          className={`whitespace-nowrap rounded-md border-2 px-3 py-1 text-xs font-semibold transition-colors ${
            selectedCourseId === 'all'
              ? 'border-[#5B21B6] bg-[#5B21B6] text-white dark:border-[#9274FF] dark:bg-[#9274FF] dark:text-[#080B14]'
              : 'border-slate-400 bg-white/60 text-ink hover:border-[#9274FF] dark:border-[#222B3D] dark:bg-[#080B14]/70'
          }`}
        >
          {isUz ? 'Barcha kurslar' : 'All Courses'}
        </button>

        {courseFilterOptions.map((courseOpt) => (
          <button
            key={courseOpt.id}
            type="button"
            onClick={() => onSelectCourseId(courseOpt.id)}
            data-testid={`ranking-matrix-filter-${courseOpt.id}`}
            className={`whitespace-nowrap rounded-md border-2 px-3 py-1 text-xs font-semibold transition-colors ${
              selectedCourseId === courseOpt.id
                ? 'border-[#5B21B6] bg-[#5B21B6] text-white dark:border-[#9274FF] dark:bg-[#9274FF] dark:text-[#080B14]'
                : 'border-slate-400 bg-white/60 text-ink hover:border-[#9274FF] dark:border-[#222B3D] dark:bg-[#080B14]/70'
            }`}
          >
            {courseOpt.title}
          </button>
        ))}
      </div>

      {/* High-Density Terminal-Style Quantitative Ranking Matrix */}
      <div className="overflow-hidden rounded-xl border-2 border-slate-500 bg-white/40 shadow-[8px_8px_0px_#090D16] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40 dark:shadow-[8px_8px_0px_#000000]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-500 bg-white/50 px-4 py-2.5 dark:border-[#222B3D] dark:bg-[#080B14]/60">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-ink">
            <Terminal className="h-3.5 w-3.5 text-[#0F766E] dark:text-[#5DE1D2]" aria-hidden="true" />
            <span>
              {isUz
                ? 'MIQDORIY REYTING MATRITSASI'
                : 'QUANTITATIVE RANKING MATRIX'}
            </span>
          </div>
          <div className="font-mono text-[11px] tabular-nums text-muted">
            {isUz
              ? `${matrixRows.length} ta yozuv · Aniqlik & Tezkorlik indeksi`
              : `${matrixRows.length} records · Accuracy & Pace Index`}
          </div>
        </div>

        {matrixRows.length === 0 ? (
          <div className="p-8 text-center font-mono text-xs text-muted">
            {isUz
              ? 'Tanlangan kurs bo‘yicha joriy haftada yakuniy baholash natijalari topilmadi.'
              : 'No weekly assessment scores recorded yet for the selected course filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="ranking-matrix-table"
              className="w-full border-collapse text-left text-xs"
            >
              <thead>
                <tr className="border-b-2 border-slate-500 bg-white/30 font-mono text-[11px] font-bold uppercase tracking-wider text-muted dark:border-[#222B3D] dark:bg-[#080B14]/40">
                  <th className="px-3.5 py-2.5">{isUz ? 'O‘RIN' : 'RANK'}</th>
                  <th className="px-3.5 py-2.5">{isUz ? 'TAXALLUS' : 'SCHOLAR'}</th>
                  <th className="px-3.5 py-2.5">
                    {isUz ? 'YO‘NALISH / KURS' : 'TRACK / ASSESSMENT'}
                  </th>
                  <th className="px-3.5 py-2.5 text-right">
                    {isUz ? 'ANIQLIK' : 'ACCURACY'}
                  </th>
                  <th className="px-3.5 py-2.5 text-right">
                    {isUz ? 'TEZKORLIK / URINISH' : 'PACE / CADENCE'}
                  </th>
                  <th className="px-3.5 py-2.5 text-right">
                    {isUz ? 'HOLAT · VAQT' : 'VERIFIED'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-400/40 dark:divide-[#222B3D]">
                {matrixRows.map((row) => (
                  <tr
                    key={row.key}
                    data-matrix-row="true"
                    data-testid={`ranking-matrix-row-${row.rank}`}
                    className={`transition-colors hover:bg-[#9274FF]/8 ${
                      row.isCurrentUser ? 'bg-[#9274FF]/14' : ''
                    }`}
                  >
                    <td className="px-3.5 py-2.5 font-mono text-xs font-bold tabular-nums text-ink">
                      #{row.indexCode}
                    </td>

                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2 font-mono font-semibold text-ink">
                        <span className="truncate">{row.pseudonym}</span>
                        {row.isCurrentUser && (
                          <span className="font-mono text-[10px] font-bold text-[#5B21B6] dark:text-[#5DE1D2]">
                            [{isUz ? 'SIZ' : 'YOU'}]
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[11px] font-bold ${getTrackAccentClass(
                            row.subject
                          )}`}
                        >
                          {row.trackCode}
                        </span>
                        <span aria-hidden="true" className="text-muted">
                          ·
                        </span>
                        <span className="font-medium text-ink">{row.courseTitle}</span>
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted">
                        {row.assessmentTitle}
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5 text-right">
                      <div className="inline-flex flex-col items-end gap-1">
                        <span className="font-mono text-xs font-bold tabular-nums text-[#047857] dark:text-[#6FE0A1]">
                          {row.accuracyText}
                        </span>
                        <div className="h-1.5 w-20 overflow-hidden border border-slate-500 bg-white/40 dark:border-[#222B3D] dark:bg-[#080B14]/80">
                          <div
                            className="h-full bg-[#047857] dark:bg-[#6FE0A1]"
                            style={{ width: `${row.accuracyPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                      <div className="text-xs font-bold text-[#0F766E] dark:text-[#5DE1D2]">
                        {row.efficiencyIndex} idx
                      </div>
                      <div className="text-[10px] text-muted">{row.cadenceText}</div>
                    </td>

                    <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                      <div
                        className={`inline-flex items-center justify-end gap-1 text-[11px] font-bold ${
                          row.passed
                            ? 'text-[#047857] dark:text-[#6FE0A1]'
                            : 'text-[#92400E] dark:text-[#FFC96B]'
                        }`}
                      >
                        {row.passed && (
                          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        )}
                        <span>{row.statusCode}</span>
                      </div>
                      <div className="text-[10px] text-muted">{row.achievedUtcText}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
