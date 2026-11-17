import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyXpChartData } from './xp-chart';
import type { XpLedgerEntry } from '../shared/types';

function makeXpEntry(overrides: Partial<XpLedgerEntry>): XpLedgerEntry {
  return {
    id: 'xp-1',
    eventType: 'lesson_completed',
    referenceId: 'les-1',
    amount: 25,
    status: 'valid',
    ruleVersion: 'v1-non-cash',
    description: 'Completed lesson',
    createdAt: '2026-11-16T12:00:00.000Z',
    ...overrides,
  };
}

test('buildWeeklyXpChartData builds 7 chronological days with zero baseline when empty', () => {
  const ref = new Date('2026-11-16T10:00:00.000Z');
  const summary = buildWeeklyXpChartData({
    xpLedger: [],
    timeZone: 'UTC',
    locale: 'en',
    referenceDate: ref,
  });

  assert.equal(summary.days.length, 7);
  assert.equal(summary.days[0].dateKey, '2026-11-10');
  assert.equal(summary.days[6].dateKey, '2026-11-16');
  assert.equal(summary.days[6].isToday, true);
  assert.equal(summary.days[0].isToday, false);
  assert.equal(summary.totalWeekXp, 0);
  assert.equal(summary.todayXp, 0);
  assert.equal(summary.activeDaysCount, 0);
});

test('buildWeeklyXpChartData aggregates valid XP per local timezone day and ignores reversed or stale entries', () => {
  const ref = new Date('2026-11-16T18:00:00.000Z'); // 2026-11-16 23:00 in Asia/Tashkent (UTC+5)
  const ledger: XpLedgerEntry[] = [
    // Today in Tashkent (Nov 16)
    makeXpEntry({ id: '1', amount: 25, createdAt: '2026-11-16T10:00:00.000Z' }),
    makeXpEntry({ id: '2', amount: 50, eventType: 'assessment_passed', createdAt: '2026-11-16T15:00:00.000Z' }),
    // 2026-11-14T20:00Z is 2026-11-15 01:00 in Asia/Tashkent!
    makeXpEntry({ id: '3', amount: 25, createdAt: '2026-11-14T20:00:00.000Z' }),
    // Reversed entry must be ignored
    makeXpEntry({ id: '4', amount: 100, status: 'reversed', createdAt: '2026-11-16T12:00:00.000Z' }),
    // Outside 7-day window (Nov 9 in Tashkent)
    makeXpEntry({ id: '5', amount: 40, createdAt: '2026-11-09T10:00:00.000Z' }),
  ];

  const summary = buildWeeklyXpChartData({
    xpLedger: ledger,
    timeZone: 'Asia/Tashkent',
    locale: 'uz',
    referenceDate: ref,
  });

  assert.equal(summary.days.find((d) => d.dateKey === '2026-11-16')?.xp, 75);
  assert.equal(summary.days.find((d) => d.dateKey === '2026-11-16')?.eventsCount, 2);
  assert.equal(summary.days.find((d) => d.dateKey === '2026-11-15')?.xp, 25);
  assert.equal(summary.totalWeekXp, 100);
  assert.equal(summary.todayXp, 75);
  assert.equal(summary.activeDaysCount, 2);
  assert.equal(summary.maxDayXp, 75);
  assert.equal(summary.days[6].label, '16 Noy');
});
