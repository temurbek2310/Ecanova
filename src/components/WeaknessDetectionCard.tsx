'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  NotebookPen,
  Radar as RadarIcon,
} from 'lucide-react';
import type {
  CourseCatalogItem,
  EnrollmentRecord,
  LocaleCode,
} from '../shared/types';
import type {
  WeaknessAnalysisSummary,
  WeaknessLessonRecommendation,
} from '../lib/study-features';
import {
  observeDocumentTheme,
  readActiveDocumentTheme,
  type ThemeMode,
} from '../lib/theme';
import {
  buildWeaknessTopicMetrics,
  resolveWeaknessRadarThemeTokens,
  STRONG_PERFORMANCE_THRESHOLD,
  type WeaknessTopicMetric,
} from '../lib/weakness-radar';
import { FloatingWatermark } from './FloatingWatermark';

export type WeaknessViewMode = 'list' | 'radar';

export interface WeaknessDetectionCardProps {
  locale: LocaleCode;
  weaknessAnalysis: WeaknessAnalysisSummary;
  courses: CourseCatalogItem[];
  enrollments: EnrollmentRecord[];
  expandedWeaknessIds: string[];
  savedWeaknessNoteIds: string[];
  onToggleExpand: (recommendationId: string) => void;
  onSaveToNotes: (recommendation: WeaknessLessonRecommendation) => void | Promise<void>;
  onReviewLesson: (courseId: string, lessonIndex: number) => void;
}

interface RadarTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: WeaknessTopicMetric }>;
  locale: LocaleCode;
}

const RadarMetricTooltip: React.FC<RadarTooltipProps> = ({
  active,
  payload,
  locale,
}) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const metric = payload[0].payload;
  const isUz = locale === 'uz';

  return (
    <div
      data-testid="weakness-radar-tooltip"
      className="min-w-[190px] border-2 border-gray-900 bg-white px-3 py-2.5 text-xs text-gray-900 shadow-[4px_4px_0px_#111827] dark:border-[#222B3D] dark:bg-[#080B14] dark:text-white dark:shadow-[4px_4px_0px_#000000]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-[#5DE1D2]">
          {metric.subject}
        </span>
        <span
          className={`border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
            metric.isStrong
              ? 'border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-[#6FE0A1]/60 dark:bg-[#6FE0A1]/15 dark:text-[#6FE0A1]'
              : 'border-violet-700 bg-violet-50 text-violet-800 dark:border-[#9274FF]/70 dark:bg-[#9274FF]/20 dark:text-[#9274FF]'
          }`}
        >
          {metric.statusLabel}
        </span>
      </div>
      <div className="mt-1.5 font-display text-xs font-bold text-gray-900 dark:text-white">
        {metric.topic}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-gray-200 pt-1.5 font-mono dark:border-[#222B3D]">
        <span className="text-[11px] text-gray-600 dark:text-[#9BA6BC]">
          {isUz ? 'O‘zlashtirish' : 'Mastery'}
        </span>
        <span
          className={`text-sm font-extrabold tabular-nums ${
            metric.isStrong
              ? 'text-emerald-700 dark:text-[#6FE0A1]'
              : 'text-teal-700 dark:text-[#5DE1D2]'
          }`}
        >
          {metric.scorePercent}%
        </span>
      </div>
      {metric.missedCount > 0 && (
        <div className="mt-1 font-mono text-[10px] font-semibold text-amber-700 dark:text-[#FFC96B]">
          {isUz
            ? `${metric.missedCount} marta xato aniqlandi`
            : `${metric.missedCount}x missed in quizzes`}
        </div>
      )}
    </div>
  );
};

interface CustomAngleTickProps {
  x?: number | string;
  y?: number | string;
  cx?: number | string;
  cy?: number | string;
  payload?: { value?: string };
  compact?: boolean;
  fill?: string;
}

function splitCompactRadarLines(label: string): string[] {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }
  if (label.length > 11) {
    return [`${label.slice(0, 10)}…`];
  }
  return [label];
}

const RadarAngleTick: React.FC<CustomAngleTickProps> = ({
  x = 0,
  y = 0,
  cx = 0,
  cy = 0,
  payload,
  compact = false,
  fill = '#E2E8F0',
}) => {
  const numX = typeof x === 'number' ? x : Number(x) || 0;
  const numY = typeof y === 'number' ? y : Number(y) || 0;
  const numCx = typeof cx === 'number' ? cx : Number(cx) || 0;
  const numCy = typeof cy === 'number' ? cy : Number(cy) || 0;

  const dx = numX - numCx;
  const dy = numY - numCy;
  const textAnchor = Math.abs(dx) < 8 ? 'middle' : dx > 0 ? 'start' : 'end';
  const offsetY = dy > 10 ? 6 : dy < -10 ? -4 : 2;
  const rawLabel = payload?.value ?? '';
  const lines = compact ? splitCompactRadarLines(rawLabel) : [rawLabel];

  return (
    <text
      x={numX}
      y={numY + offsetY}
      textAnchor={textAnchor}
      fill={fill}
      fontSize={compact ? 9.5 : 11}
      fontWeight={600}
      fontFamily="var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)"
    >
      {lines.map((line, idx) => (
        <tspan
          key={`${rawLabel}-line-${idx}`}
          x={numX}
          dy={idx === 0 ? (lines.length > 1 ? -4 : 0) : 11}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
};

export const WeaknessDetectionCard: React.FC<WeaknessDetectionCardProps> = ({
  locale,
  weaknessAnalysis,
  courses,
  enrollments,
  expandedWeaknessIds,
  savedWeaknessNoteIds,
  onToggleExpand,
  onSaveToNotes,
  onReviewLesson,
}) => {
  const [viewMode, setViewMode] = useState<WeaknessViewMode>('radar');
  const [isCompactRadar, setIsCompactRadar] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeMode>(() =>
    readActiveDocumentTheme()
  );
  const radarWrapperRef = useRef<HTMLDivElement | null>(null);
  const isUz = locale === 'uz';

  useEffect(() => {
    setActiveTheme(readActiveDocumentTheme());
    return observeDocumentTheme((nextTheme) => {
      setActiveTheme(nextTheme);
    });
  }, []);

  useEffect(() => {
    const el = radarWrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateWidth = () => {
      setIsCompactRadar(el.clientWidth > 0 && el.clientWidth < 430);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewMode]);

  const radarTokens = useMemo(
    () => resolveWeaknessRadarThemeTokens(activeTheme),
    [activeTheme]
  );

  const topicMetrics = useMemo(
    () =>
      buildWeaknessTopicMetrics({
        analysis: weaknessAnalysis,
        courses,
        enrollments,
        locale,
      }),
    [weaknessAnalysis, courses, enrollments, locale]
  );

  const weakCount = topicMetrics.filter((m) => !m.isStrong).length;
  const strongCount = topicMetrics.filter((m) => m.isStrong).length;
  const recommendationGridCols =
    weaknessAnalysis.recommendations.length === 1
      ? 'md:grid-cols-1'
      : weaknessAnalysis.recommendations.length === 2
      ? 'md:grid-cols-2'
      : 'md:grid-cols-3';

  return (
    <section
      data-testid="weakness-detection-card"
      data-theme-mode={activeTheme}
      aria-labelledby="weakness-detection-heading"
      className="relative z-10 overflow-hidden rounded-xl border-2 border-slate-500 bg-white/25 p-5 text-gray-900 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl sm:p-6 dark:border-[#222B3D] dark:bg-[#101522]/25 dark:text-white"
    >
      <FloatingWatermark
        theme="analytics"
        seedIndex={2}
        testId="weakness-floating-watermark"
      />

      {/* Card Header + Segmented View Toggle */}
      <div className="relative z-10 flex flex-col gap-4 border-b-2 border-gray-900 pb-4 lg:flex-row lg:items-start lg:justify-between dark:border-[#222B3D]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 border-2 border-gray-900 bg-gray-50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:border-[#222B3D] dark:bg-[#080B14]/85 dark:text-[#5DE1D2]">
              <AlertTriangle
                className="h-3.5 w-3.5 text-amber-600 dark:text-[#FFC96B]"
                aria-hidden="true"
              />
              {isUz ? 'Zaif nuqtalarni aniqlash' : 'Weakness Detection Engine'}
            </span>
            <span
              data-testid="weakness-detection-status-badge"
              className="border border-gray-900 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-800 dark:border-[#222B3D] dark:bg-[#080B14]/70 dark:text-[#CBD5E1]"
            >
              {weaknessAnalysis.hasRecordedQuizFailures
                ? isUz
                  ? `${weaknessAnalysis.totalMissedPatterns} ta xato tahlil qilindi`
                  : `${weaknessAnalysis.totalMissedPatterns} missed quiz items analyzed`
                : isUz
                ? 'Proaktiv diagnostika'
                : 'Proactive Diagnostic'}
            </span>
          </div>
          <h2
            id="weakness-detection-heading"
            className="mt-2 font-display text-lg font-extrabold text-gray-900 dark:text-white"
          >
            {isUz
              ? 'Test xatolari tahlili va tavsiya etilgan darslar'
              : 'Quiz Failure Pattern Analysis & Topic Mastery'}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-700 dark:text-[#CBD5E1]">
            {weaknessAnalysis.hasRecordedQuizFailures
              ? isUz
                ? 'So‘nggi test urinishlaridagi noto‘g‘ri javoblar asosida takrorlash uchun tavsiya etilgan darslar.'
                : 'Targeted lesson recommendations and mastery radar generated from your recent quiz patterns.'
              : isUz
              ? 'Yakuniy testdan oldin eng muhim va murakkab mavzularni mustahkamlash uchun tahlil.'
              : 'Diagnostic competency map highlighting priority review topics before course assessments.'}
          </p>
        </div>

        {/* Neobrutalist Segmented Control Toggle */}
        <div
          role="group"
          aria-label={isUz ? 'Ko‘rinish rejimi' : 'Weakness display view'}
          className="inline-flex shrink-0 self-start border-2 border-gray-900 bg-gray-100 p-1 shadow-[3px_3px_0px_#111827] dark:border-[#222B3D] dark:bg-[#080B14]/85 dark:shadow-[3px_3px_0px_#000000]"
        >
          <button
            type="button"
            data-testid="weakness-view-toggle-radar"
            aria-pressed={viewMode === 'radar'}
            onClick={() => setViewMode('radar')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
              viewMode === 'radar'
                ? 'border-2 border-gray-900 bg-[#9274FF] text-gray-950 shadow-[2px_2px_0px_#111827] dark:border-[#080B14] dark:text-[#080B14] dark:shadow-[2px_2px_0px_#000000]'
                : 'border-2 border-transparent bg-transparent text-gray-700 hover:text-gray-950 dark:text-[#CBD5E1] dark:hover:text-white'
            }`}
          >
            <RadarIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{isUz ? 'Radar xarita' : 'Radar Chart'}</span>
          </button>
          <button
            type="button"
            data-testid="weakness-view-toggle-list"
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
              viewMode === 'list'
                ? 'border-2 border-gray-900 bg-[#9274FF] text-gray-950 shadow-[2px_2px_0px_#111827] dark:border-[#080B14] dark:text-[#080B14] dark:shadow-[2px_2px_0px_#000000]'
                : 'border-2 border-transparent bg-transparent text-gray-700 hover:text-gray-950 dark:text-[#CBD5E1] dark:hover:text-white'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{isUz ? 'Ro‘yxat' : 'List View'}</span>
          </button>
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'radar' ? (
        <div
          data-testid="weakness-radar-view"
          className="relative z-10 mt-5 grid gap-5 lg:grid-cols-12"
        >
          {/* Left: Tactical Recharts Radar HUD */}
          <div
            data-testid="weakness-radar-panel"
            className="border-2 border-gray-900 bg-white/30 p-4 text-gray-900 shadow-[6px_6px_0px_#111827] backdrop-blur-xl lg:col-span-7 dark:border-[#222B3D] dark:bg-[#101522]/30 dark:text-white dark:shadow-[6px_6px_0px_#000000]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gray-900 pb-3 dark:border-[#222B3D]">
              <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-[#5DE1D2]">
                {isUz ? 'Mavzular kesimidagi tayyorgarlik' : 'Competency Radar Envelope'}
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
                <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-[#CBD5E1]">
                  <span
                    className="inline-block h-2.5 w-2.5 border border-teal-700 bg-teal-500/20 dark:border-[#5DE1D2] dark:bg-[#5DE1D2]/25"
                    aria-hidden="true"
                  />
                  {isUz ? 'O‘zlashtirish (%)' : 'Mastery %'}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-[#6FE0A1]">
                  <span
                    className="inline-block h-2.5 w-2.5 bg-emerald-600 dark:bg-[#6FE0A1]"
                    aria-hidden="true"
                  />
                  {strongCount} {isUz ? 'kuchli' : 'strong'}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700 dark:text-[#9274FF]">
                  <span
                    className="inline-block h-2.5 w-2.5 bg-violet-600 dark:bg-[#9274FF]"
                    aria-hidden="true"
                  />
                  {weakCount} {isUz ? 'zaif' : 'weak'}
                </span>
              </div>
            </div>

            <div
              ref={radarWrapperRef}
              data-testid="weakness-radar-chart"
              className="mt-2 h-[290px] w-full sm:h-[340px]"
              role="img"
              aria-label={
                isUz
                  ? 'Mavzular bo‘yicha zaif va kuchli nuqtalar radar diagrammasi'
                  : 'Topic mastery and weakness detection radar chart'
              }
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <RadarChart
                  data={topicMetrics}
                  cx="50%"
                  cy="50%"
                  outerRadius={isCompactRadar ? '48%' : '68%'}
                  margin={
                    isCompactRadar
                      ? { top: 20, right: 20, bottom: 20, left: 20 }
                      : { top: 20, right: 44, bottom: 20, left: 44 }
                  }
                >
                  <PolarGrid
                    gridType="polygon"
                    stroke={radarTokens.polarGridStroke}
                    strokeWidth={1.35}
                  />
                  <PolarAngleAxis
                    dataKey="shortLabel"
                    tick={
                      <RadarAngleTick
                        compact={isCompactRadar}
                        fill={radarTokens.angleTickFill}
                      />
                    }
                    tickLine={false}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tickCount={5}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name={isUz ? 'O‘zlashtirish' : 'Mastery'}
                    dataKey="scorePercent"
                    stroke={radarTokens.radarStroke}
                    strokeWidth={2}
                    fill={radarTokens.radarFill}
                    fillOpacity={radarTokens.radarFillOpacity}
                    dot={{
                      r: 3.5,
                      fill: radarTokens.radarStroke,
                      stroke: radarTokens.dotStroke,
                      strokeWidth: 1.5,
                    }}
                    activeDot={{
                      r: 5.5,
                      fill: radarTokens.activeDotFill,
                      stroke: radarTokens.activeDotStroke,
                      strokeWidth: 2,
                    }}
                  />
                  <Tooltip
                    content={<RadarMetricTooltip locale={locale} />}
                    cursor={{ stroke: radarTokens.tooltipCursorStroke, strokeWidth: 1.5 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Priority Weaknesses & Quick Review Queue */}
          <div className="flex flex-col justify-between gap-3 lg:col-span-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-[#CBD5E1]">
                  {isUz ? 'Ustuvor takrorlash navbati' : 'Priority Review Queue'}
                </span>
                <span className="font-mono text-[10px] font-bold text-teal-700 tabular-nums dark:text-[#5DE1D2]">
                  &lt; {STRONG_PERFORMANCE_THRESHOLD}% = {isUz ? 'Zaif' : 'Focus'}
                </span>
              </div>

              {weaknessAnalysis.recommendations.length > 0 ? (
                weaknessAnalysis.recommendations.map((rec, index) => {
                  const matchingMetric = topicMetrics.find((m) => m.id === rec.id);
                  const isSavedToNotes = savedWeaknessNoteIds.includes(rec.id);
                  return (
                    <div
                      key={rec.id}
                      data-testid={`weakness-radar-item-${index}`}
                      className="border-2 border-gray-900 bg-white/30 p-3.5 text-gray-900 shadow-[6px_6px_0px_#111827] backdrop-blur-xl dark:border-[#222B3D] dark:bg-[#101522]/30 dark:text-white dark:shadow-[6px_6px_0px_#000000]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[10px] font-bold uppercase text-teal-700 dark:text-[#5DE1D2]">
                          {rec.weakTopicLabel}
                        </span>
                        <span className="shrink-0 border border-violet-700 bg-violet-100 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-violet-800 dark:border-[#9274FF]/70 dark:bg-[#9274FF]/15 dark:text-[#9274FF]">
                          {matchingMetric?.scorePercent ?? 50}%
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-bold text-gray-900 dark:text-white">
                        {rec.lessonIndex + 1}. {rec.lessonTitle}
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onSaveToNotes(rec)}
                          className={`inline-flex min-h-[32px] items-center gap-1.5 border-2 px-2.5 py-1 font-mono text-[11px] font-bold whitespace-nowrap transition-colors ${
                            isSavedToNotes
                              ? 'border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-[#6FE0A1] dark:bg-[#6FE0A1]/15 dark:text-[#6FE0A1]'
                              : 'border-gray-900 bg-white text-gray-900 hover:border-[#6D28D9] hover:text-[#6D28D9] dark:border-[#222B3D] dark:bg-[#080B14] dark:text-white dark:hover:border-[#9274FF] dark:hover:text-[#9274FF]'
                          }`}
                        >
                          {isSavedToNotes ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <NotebookPen
                              className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-[#5DE1D2]"
                              aria-hidden="true"
                            />
                          )}
                          <span>
                            {isSavedToNotes
                              ? isUz
                                ? 'Saqlandi'
                                : 'Saved'
                              : isUz
                              ? 'Qaydga'
                              : 'Save Note'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onReviewLesson(rec.courseId, rec.lessonIndex)}
                          className="inline-flex min-h-[32px] items-center gap-1 border-2 border-gray-900 bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-gray-900 whitespace-nowrap transition-colors hover:border-teal-700 hover:text-teal-800 dark:border-[#222B3D] dark:bg-[#080B14] dark:text-white dark:hover:border-[#5DE1D2] dark:hover:text-[#5DE1D2]"
                        >
                          <span>{isUz ? 'Darsni ochish' : 'Review'}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  data-testid="weakness-radar-empty-queue"
                  className="border-2 border-gray-900 bg-white/30 p-4 font-mono text-xs text-gray-800 shadow-[6px_6px_0px_#111827] backdrop-blur-xl dark:border-[#222B3D] dark:bg-[#101522]/30 dark:text-[#CBD5E1] dark:shadow-[6px_6px_0px_#000000]"
                >
                  {isUz
                    ? 'Kurslar kesimidagi tahlil yuklanmoqda…'
                    : 'Calibrating topic recommendations across published courses…'}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="inline-flex min-h-[38px] w-full items-center justify-center gap-2 border-2 border-gray-900 bg-white/30 px-3 py-2 font-mono text-xs font-bold text-gray-900 shadow-[4px_4px_0px_#111827] backdrop-blur-xl transition-colors hover:border-[#6D28D9] hover:text-[#6D28D9] dark:border-[#222B3D] dark:bg-[#101522]/30 dark:text-white dark:shadow-[4px_4px_0px_#000000] dark:hover:border-[#9274FF] dark:hover:text-[#9274FF]"
            >
              <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {isUz
                  ? 'Barcha mavzular va progress barlarni ko‘rish'
                  : 'Inspect Full Topic Bars & Lesson Previews'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* List View (Fallback): Same data points as blocky rounded-none horizontal progress bars + detailed recommendations */
        <div data-testid="weakness-list-view" className="relative z-10 mt-5 space-y-5">
          {/* Blocky Horizontal Progress Bars */}
          <div className="border-2 border-gray-900 bg-white/30 p-4 text-gray-900 shadow-[6px_6px_0px_#111827] backdrop-blur-xl dark:border-[#222B3D] dark:bg-[#101522]/30 dark:text-white dark:shadow-[6px_6px_0px_#000000]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gray-900 pb-3 dark:border-[#222B3D]">
              <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                {isUz
                  ? 'Mavzular kesimidagi tayyorgarlik darajasi'
                  : 'Topic Mastery & Weakness Bars'}
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-[#6FE0A1]">
                  <span
                    className="inline-block h-2.5 w-2.5 bg-emerald-600 dark:bg-[#6FE0A1]"
                    aria-hidden="true"
                  />
                  {isUz ? 'Kuchli (≥ 70%)' : 'Strong (≥ 70%)'}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700 dark:text-[#9274FF]">
                  <span
                    className="inline-block h-2.5 w-2.5 bg-violet-600 dark:bg-[#9274FF]"
                    aria-hidden="true"
                  />
                  {isUz ? 'Zaif nuqta (< 70%)' : 'Weakness (< 70%)'}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3.5 md:grid-cols-2">
              {topicMetrics.map((metric, idx) => (
                <div
                  key={metric.id}
                  data-testid={`weakness-progress-row-${idx}`}
                  data-strong={metric.isStrong ? 'true' : 'false'}
                  className="border-2 border-gray-900 bg-gray-50 p-3 dark:border-[#222B3D] dark:bg-[#080B14]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-[#CBD5E1]">
                        {metric.subject}
                      </span>
                      <div className="truncate text-xs font-bold text-gray-900 dark:text-white">
                        {metric.topic}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          metric.isStrong
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-[#6FE0A1]/60 dark:bg-[#6FE0A1]/15 dark:text-[#6FE0A1]'
                            : 'border-violet-700 bg-violet-50 text-violet-800 dark:border-[#9274FF]/70 dark:bg-[#9274FF]/15 dark:text-[#9274FF]'
                        }`}
                      >
                        {metric.statusLabel}
                      </span>
                      <span
                        className="font-mono text-xs font-extrabold tabular-nums"
                        style={{
                          color: metric.isStrong
                            ? radarTokens.strongMetricHex
                            : radarTokens.weakMetricHex,
                        }}
                      >
                        {metric.scorePercent}%
                      </span>
                    </div>
                  </div>

                  {/* Thick, blocky progress track without rounded corners */}
                  <div
                    role="progressbar"
                    aria-label={metric.topic}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={metric.scorePercent}
                    className="mt-2.5 h-4 w-full overflow-hidden rounded-none border-2 border-gray-900 bg-gray-200 dark:border-[#222B3D] dark:bg-[#101522]"
                  >
                    <div
                      data-testid={`weakness-progress-fill-${idx}`}
                      className={`h-full rounded-none transition-[width] duration-300 ${
                        metric.isStrong
                          ? 'bg-emerald-600 dark:bg-[#6FE0A1]'
                          : 'bg-violet-600 dark:bg-[#9274FF]'
                      }`}
                      style={{ width: `${metric.scorePercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Targeted Lesson Recommendations with Expand & Save to Notes */}
          <div className={`grid gap-3 ${recommendationGridCols}`}>
            {weaknessAnalysis.recommendations.map((rec, index) => {
              const isExpanded = expandedWeaknessIds.includes(rec.id);
              const isSavedToNotes = savedWeaknessNoteIds.includes(rec.id);
              const previewPanelId = `weakness-preview-panel-${index}`;
              return (
                <div
                  key={rec.id}
                  data-testid={`weakness-recommendation-${index}`}
                  className="flex flex-col justify-between border-2 border-gray-900 bg-white/30 p-4 text-gray-900 shadow-[6px_6px_0px_#111827] backdrop-blur-xl dark:border-[#222B3D] dark:bg-[#101522]/30 dark:text-white dark:shadow-[6px_6px_0px_#000000]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="border border-teal-700 bg-teal-50 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-800 dark:border-[#5DE1D2]/50 dark:bg-[#5DE1D2]/10 dark:text-[#5DE1D2]">
                        {rec.weakTopicLabel}
                      </span>
                      <span
                        className={`border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          rec.severity === 'high'
                            ? 'border-rose-700 bg-rose-50 text-rose-800 dark:border-[#FB7185]/60 dark:bg-[#4C0519]/60 dark:text-[#FECDD3]'
                            : rec.severity === 'moderate'
                            ? 'border-amber-700 bg-amber-50 text-amber-800 dark:border-[#FFC96B]/60 dark:bg-[#FFC96B]/15 dark:text-[#FFC96B]'
                            : 'border-violet-700 bg-violet-50 text-violet-800 dark:border-[#9274FF]/60 dark:bg-[#9274FF]/15 dark:text-[#9274FF]'
                        }`}
                      >
                        {rec.missedCount > 0
                          ? isUz
                            ? `${rec.missedCount} marta xato`
                            : `${rec.missedCount}x missed`
                          : isUz
                          ? 'Ko‘rib chiqish'
                          : 'Recommended'}
                      </span>
                    </div>
                    <div className="mt-2 truncate text-[11px] font-semibold text-gray-600 dark:text-[#CBD5E1]">
                      {rec.courseTitle}
                    </div>
                    <h3 className="mt-0.5 text-sm font-bold text-gray-900 dark:text-white">
                      {rec.lessonIndex + 1}. {rec.lessonTitle}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-gray-700 dark:text-[#CBD5E1]">
                      {rec.diagnosticReason}
                    </p>

                    {isExpanded && (
                      <div
                        id={previewPanelId}
                        data-testid={`weakness-preview-panel-${index}`}
                        className="mt-3 space-y-2.5 border-2 border-gray-900 bg-gray-50 p-3 text-xs dark:border-[#222B3D] dark:bg-[#080B14]"
                      >
                        <div>
                          <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-[#5DE1D2]">
                            {isUz ? 'Dars qisqacha mazmuni' : 'Lesson Content Preview'}
                          </div>
                          <p
                            data-testid={`weakness-preview-summary-${index}`}
                            className="mt-1 text-xs leading-relaxed text-gray-900 dark:text-white"
                          >
                            {rec.lessonPreviewSummary}
                          </p>
                        </div>

                        {rec.keyConcepts.length > 0 && (
                          <div>
                            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-[#CBD5E1]">
                              {isUz ? 'Asosiy tushunchalar' : 'Key Concepts'}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {rec.keyConcepts.map((concept, cIdx) => (
                                <span
                                  key={`${rec.id}-concept-${cIdx}`}
                                  data-testid={`weakness-preview-concept-${index}-${cIdx}`}
                                  className="inline-flex items-center border border-gray-900 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-800 dark:border-[#222B3D] dark:bg-[#101522] dark:text-[#9274FF]"
                                >
                                  {concept}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 border-t-2 border-gray-200 pt-3 dark:border-[#222B3D]">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={previewPanelId}
                        data-testid={`weakness-expand-toggle-${index}`}
                        onClick={() => onToggleExpand(rec.id)}
                        className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 border-2 border-gray-900 bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-900 shadow-[3px_3px_0px_#111827] whitespace-nowrap transition-colors hover:border-teal-700 hover:text-teal-800 dark:border-[#222B3D] dark:bg-[#080B14] dark:text-white dark:shadow-[3px_3px_0px_#000000] dark:hover:border-[#5DE1D2] dark:hover:text-[#5DE1D2]"
                      >
                        <span>
                          {isExpanded
                            ? isUz
                              ? 'Yopish'
                              : 'Collapse'
                            : isUz
                            ? 'Batafsil'
                            : 'Expand'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        )}
                      </button>

                      <button
                        type="button"
                        data-testid={`weakness-save-notes-btn-${index}`}
                        data-saved={isSavedToNotes ? 'true' : 'false'}
                        onClick={() => void onSaveToNotes(rec)}
                        className={`inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 border-2 px-2.5 py-1.5 text-xs font-bold shadow-[3px_3px_0px_#111827] whitespace-nowrap transition-colors dark:shadow-[3px_3px_0px_#000000] ${
                          isSavedToNotes
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-[#6FE0A1] dark:bg-[#6FE0A1]/15 dark:text-[#6FE0A1]'
                            : 'border-gray-900 bg-gray-50 text-gray-900 hover:border-[#6D28D9] hover:text-[#6D28D9] dark:border-[#222B3D] dark:bg-[#080B14] dark:text-white dark:hover:border-[#9274FF] dark:hover:text-[#9274FF]'
                        }`}
                      >
                        {isSavedToNotes ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <NotebookPen
                            className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-[#5DE1D2]"
                            aria-hidden="true"
                          />
                        )}
                        <span>
                          {isSavedToNotes
                            ? isUz
                              ? 'Qaydlarga saqlandi'
                              : 'Saved to Notes'
                            : isUz
                            ? 'Qaydlarga saqlash'
                            : 'Save to Notes'}
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      data-testid={`weakness-review-lesson-btn-${index}`}
                      onClick={() => onReviewLesson(rec.courseId, rec.lessonIndex)}
                      className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 border-2 border-gray-900 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-900 shadow-[3px_3px_0px_#111827] transition-colors hover:border-[#6D28D9] hover:text-[#6D28D9] dark:border-[#222B3D] dark:bg-[#080B14] dark:text-white dark:shadow-[3px_3px_0px_#000000] dark:hover:border-[#9274FF] dark:hover:text-[#9274FF]"
                    >
                      <span>{isUz ? 'Darsni takrorlash' : 'Review Lesson'}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
