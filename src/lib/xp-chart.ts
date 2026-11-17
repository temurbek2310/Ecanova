import { formatLocalDateKey, previousDateKey } from '../shared/econova-rules';
import type { LocaleCode, XpLedgerEntry } from '../shared/types';

export interface DailyXpPoint {
  dateKey: string;
  label: string;
  fullDateLabel: string;
  xp: number;
  eventsCount: number;
  isToday: boolean;
}

export interface WeeklyXpSummary {
  days: DailyXpPoint[];
  totalWeekXp: number;
  todayXp: number;
  activeDaysCount: number;
  maxDayXp: number;
}

const UZ_MONTHS_SHORT = [
  'Yan',
  'Fev',
  'Mar',
  'Apr',
  'May',
  'Iyun',
  'Iyul',
  'Avg',
  'Sen',
  'Okt',
  'Noy',
  'Dek',
];

const UZ_WEEKDAYS_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

export function formatChartDateLabels(
  dateKey: string,
  locale: LocaleCode
): { label: string; fullDateLabel: string } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (locale === 'uz') {
    const weekday = UZ_WEEKDAYS_SHORT[utcDate.getUTCDay()] ?? '';
    const monthLabel = UZ_MONTHS_SHORT[month - 1] ?? String(month);
    return {
      label: `${day} ${monthLabel}`,
      fullDateLabel: `${weekday}, ${day} ${monthLabel} ${year}`,
    };
  }

  try {
    const shortFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    });
    const fullFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return {
      label: shortFmt.format(utcDate),
      fullDateLabel: fullFmt.format(utcDate),
    };
  } catch {
    return { label: dateKey.slice(5), fullDateLabel: dateKey };
  }
}

export function buildWeeklyXpChartData(params: {
  xpLedger: XpLedgerEntry[];
  timeZone: string;
  locale: LocaleCode;
  referenceDate?: Date;
}): WeeklyXpSummary {
  const refDate = params.referenceDate ?? new Date();
  const todayKey = formatLocalDateKey(refDate, params.timeZone);

  const dateKeysDescending: string[] = [todayKey];
  let cursor = todayKey;
  for (let i = 0; i < 6; i++) {
    cursor = previousDateKey(cursor);
    dateKeysDescending.push(cursor);
  }
  const orderedKeys = dateKeysDescending.reverse();

  const xpByDay = new Map<string, { xp: number; count: number }>();
  for (const key of orderedKeys) {
    xpByDay.set(key, { xp: 0, count: 0 });
  }

  for (const entry of params.xpLedger) {
    if (entry.status !== 'valid' || entry.amount <= 0 || !entry.createdAt) {
      continue;
    }
    const createdDate = new Date(entry.createdAt);
    if (Number.isNaN(createdDate.getTime())) {
      continue;
    }
    const entryDayKey = formatLocalDateKey(createdDate, params.timeZone);
    const bucket = xpByDay.get(entryDayKey);
    if (bucket) {
      bucket.xp += entry.amount;
      bucket.count += 1;
    }
  }

  const days: DailyXpPoint[] = orderedKeys.map((dateKey) => {
    const bucket = xpByDay.get(dateKey) ?? { xp: 0, count: 0 };
    const { label, fullDateLabel } = formatChartDateLabels(dateKey, params.locale);
    return {
      dateKey,
      label,
      fullDateLabel,
      xp: bucket.xp,
      eventsCount: bucket.count,
      isToday: dateKey === todayKey,
    };
  });

  const totalWeekXp = days.reduce((sum, d) => sum + d.xp, 0);
  const todayXp = days[days.length - 1]?.xp ?? 0;
  const activeDaysCount = days.filter((d) => d.xp > 0).length;
  const maxDayXp = days.reduce((max, d) => Math.max(max, d.xp), 0);

  return {
    days,
    totalWeekXp,
    todayXp,
    activeDaysCount,
    maxDayXp,
  };
}
