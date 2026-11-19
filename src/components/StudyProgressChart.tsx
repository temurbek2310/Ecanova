import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { DAILY_XP_CAP } from '../shared/econova-rules';
import type { LocaleCode, XpLedgerEntry } from '../shared/types';
import { t } from '../lib/i18n';
import { buildWeeklyXpChartData, type DailyXpPoint } from '../lib/xp-chart';
import { FloatingWatermark } from './FloatingWatermark';

interface StudyProgressChartProps {
  locale: LocaleCode;
  isAuthenticated: boolean;
  xpLedger: XpLedgerEntry[];
  timeZone: string;
  onRequireAuth: () => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: DailyXpPoint }>;
  locale: LocaleCode;
}

const XpTooltip: React.FC<CustomTooltipProps> = ({ active, payload, locale }) => {
  const strings = t(locale);
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-line-strong bg-elevated px-3 py-2 text-xs text-ink shadow-md">
      <div className="font-medium text-ink">
        {point.fullDateLabel}
        {point.isToday ? ` (${strings.overviewChart.todayLabel})` : ''}
      </div>
      <div className="mt-1 font-mono font-semibold tabular-nums text-teal">
        +{point.xp} XP
      </div>
      <div className="text-[11px] text-muted">
        {point.eventsCount}{' '}
        {point.eventsCount === 1
          ? strings.overviewChart.eventSingular
          : strings.overviewChart.eventPlural}
      </div>
    </div>
  );
};

export const StudyProgressChart: React.FC<StudyProgressChartProps> = ({
  locale,
  isAuthenticated,
  xpLedger,
  timeZone,
  onRequireAuth,
}) => {
  const strings = t(locale);

  const summary = useMemo(
    () =>
      buildWeeklyXpChartData({
        xpLedger: isAuthenticated ? xpLedger : [],
        timeZone,
        locale,
      }),
    [isAuthenticated, xpLedger, timeZone, locale]
  );

  const yAxisMax = Math.max(50, Math.ceil(summary.maxDayXp / 25) * 25);

  return (
    <section
      aria-labelledby="study-progress-chart-title"
      className="relative overflow-hidden rounded-xl border-2 border-slate-500 bg-white/25 p-5 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl sm:p-6 dark:border-[#222B3D] dark:bg-[#101522]/25"
    >
      <FloatingWatermark
        theme="analytics"
        seedIndex={1}
        testId="study-progress-floating-watermark"
      />

      <div className="relative z-10 flex flex-col gap-3 border-b-2 border-slate-400/70 pb-4 dark:border-[#222B3D]">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h2
              id="study-progress-chart-title"
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base font-semibold text-ink"
            >
              <TrendingUp className="h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
              {(() => {
                const rawTitle = strings.overviewChart.title;
                const parenIdx = rawTitle.indexOf('(');
                if (parenIdx <= 0) {
                  return <span>{rawTitle}</span>;
                }
                const prefix = rawTitle.slice(0, parenIdx).trimEnd();
                const suffix = rawTitle.slice(parenIdx);
                return (
                  <span className="leading-snug">
                    {prefix}{' '}
                    <span className="whitespace-nowrap">{suffix}</span>
                  </span>
                );
              })()}
            </h2>
            <p className="mt-1 text-xs text-muted">{strings.overviewChart.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs shrink-0">
            <div className="whitespace-nowrap">
              <span className="text-muted">{strings.overviewChart.weeklyTotal}: </span>
              <span className="font-mono font-semibold tabular-nums text-accent">
                {summary.totalWeekXp} XP
              </span>
            </div>
            <div className="whitespace-nowrap">
              <span className="text-muted">{strings.overviewChart.activeDays}: </span>
              <span className="font-mono font-semibold tabular-nums text-teal">
                {summary.activeDaysCount} / 7
              </span>
            </div>
            <div className="whitespace-nowrap">
              <span className="text-muted">{strings.overviewChart.dailyCap}: </span>
              <span className="font-mono tabular-nums text-ink">{DAILY_XP_CAP} XP</span>
            </div>
          </div>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-slate-400 bg-white/50 px-4 py-3 text-xs backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/55">
          <span className="text-muted">{strings.overviewChart.guestNotice}</span>
          <button
            type="button"
            onClick={onRequireAuth}
            className="min-h-[34px] rounded-md bg-accent px-3 py-1 font-semibold text-accent-ink hover:bg-accent-hover whitespace-nowrap"
          >
            {strings.signIn}
          </button>
        </div>
      )}

      <div
        className="relative z-10 mt-4 h-[220px] w-full"
        role="img"
        aria-label={strings.overviewChart.ariaLabel}
        data-testid="weekly-xp-chart"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={summary.days}
            margin={{ top: 10, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid
              stroke="var(--econova-line)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--econova-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--econova-line)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, yAxisMax]}
              allowDecimals={false}
              tick={{ fill: 'var(--econova-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--econova-elevated)', opacity: 0.45 }}
              content={<XpTooltip locale={locale} />}
            />
            <Bar dataKey="xp" radius={[6, 6, 0, 0]} maxBarSize={42}>
              {summary.days.map((entry) => (
                <Cell
                  key={entry.dateKey}
                  fill={
                    entry.isToday
                      ? 'var(--econova-teal)'
                      : entry.xp > 0
                      ? 'var(--econova-accent)'
                      : 'var(--econova-line-strong)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
