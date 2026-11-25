import type { LocaleCode, QuizLeaderboardEntry, Subject } from '../shared/types';

export interface RawQuizAttemptRow {
  userId: string;
  pseudonym: string;
  leaderboardOptIn: boolean;
  courseId: string;
  courseTitle: string;
  subject: Subject;
  assessmentId: string;
  assessmentTitle: string;
  scorePercent: number;
  passed: boolean;
  createdAt: string;
}

export interface WeekWindow {
  weekStartIso: string;
  weekEndIso: string;
}

export interface QuizLeaderboardSummary {
  topScorePercent: number;
  averageScorePercent: number;
  passRatePercent: number;
  participantCount: number;
}

/**
 * Computes a rolling 7-day current week window ending at `referenceDate` (inclusive).
 */
export function getCurrentWeekWindow(referenceDate: Date = new Date()): WeekWindow {
  const endMs = referenceDate.getTime();
  const startMs = endMs - 7 * 24 * 60 * 60 * 1000;
  return {
    weekStartIso: new Date(startMs).toISOString(),
    weekEndIso: new Date(endMs).toISOString(),
  };
}

export function formatWeekWindowLabel(
  weekStartIso: string,
  weekEndIso: string,
  locale: LocaleCode
): string {
  const start = new Date(weekStartIso);
  const end = new Date(weekEndIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return locale === 'uz' ? 'Joriy hafta (7 kun)' : 'Current Week (Last 7 Days)';
  }
  const fmt = new Intl.DateTimeFormat(locale === 'uz' ? 'uz-Latn-UZ' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/**
 * Ranks weekly course assessment attempts into top-scorer leaderboard entries.
 * - Filters to learners with `leaderboardOptIn === true`
 * - Filters to attempts within `[weekStartIso, weekEndIso]`
 * - Optionally filters to a specific `courseId` (when `courseId` is provided and not `'all'`)
 * - Aggregates each learner's best score per course assessment over the current week
 * - Breaks ties by:
 *   1. Higher `bestScorePercent`
 *   2. Passed status (`true` before `false`)
 *   3. Fewer `attemptsCountThisWeek`
 *   4. Earlier `achievedAt` timestamp
 */
export function rankWeeklyQuizAttempts(
  attempts: RawQuizAttemptRow[],
  options: {
    currentUserId?: string | null;
    courseId?: string;
    weekStartIso?: string;
    weekEndIso?: string;
    limit?: number;
  } = {}
): QuizLeaderboardEntry[] {
  const startMs = options.weekStartIso ? new Date(options.weekStartIso).getTime() : null;
  const endMs = options.weekEndIso ? new Date(options.weekEndIso).getTime() : null;
  const courseFilter =
    options.courseId && options.courseId !== 'all' ? options.courseId.trim() : null;

  const grouped = new Map<
    string,
    {
      userId: string;
      pseudonym: string;
      courseId: string;
      courseTitle: string;
      subject: Subject;
      assessmentId: string;
      assessmentTitle: string;
      bestScorePercent: number;
      attemptsCountThisWeek: number;
      passed: boolean;
      achievedAt: string;
    }
  >();

  for (const row of attempts) {
    if (!row.leaderboardOptIn) continue;
    if (courseFilter && row.courseId !== courseFilter) continue;

    const createdMs = new Date(row.createdAt).getTime();
    if (!Number.isFinite(createdMs)) continue;
    if (startMs !== null && Number.isFinite(startMs) && createdMs < startMs) continue;
    if (endMs !== null && Number.isFinite(endMs) && createdMs > endMs) continue;

    const cleanScore = Math.max(0, Math.min(100, Math.round(Number(row.scorePercent) || 0)));
    const key = `${row.userId}::${row.courseId}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        userId: row.userId,
        pseudonym: row.pseudonym || '', // UI renders a localized "Anonymous learner"
        courseId: row.courseId,
        courseTitle: row.courseTitle,
        subject: row.subject,
        assessmentId: row.assessmentId,
        assessmentTitle: row.assessmentTitle,
        bestScorePercent: cleanScore,
        attemptsCountThisWeek: 1,
        passed: Boolean(row.passed),
        achievedAt: row.createdAt,
      });
    } else {
      existing.attemptsCountThisWeek += 1;
      existing.passed = existing.passed || Boolean(row.passed);
      if (
        cleanScore > existing.bestScorePercent ||
        (cleanScore === existing.bestScorePercent &&
          new Date(row.createdAt).getTime() < new Date(existing.achievedAt).getTime())
      ) {
        existing.bestScorePercent = cleanScore;
        existing.achievedAt = row.createdAt;
        existing.assessmentId = row.assessmentId;
        existing.assessmentTitle = row.assessmentTitle;
      }
    }
  }

  const sorted = Array.from(grouped.values()).sort((a, b) => {
    if (b.bestScorePercent !== a.bestScorePercent) {
      return b.bestScorePercent - a.bestScorePercent;
    }
    if (a.passed !== b.passed) {
      return a.passed ? -1 : 1;
    }
    if (a.attemptsCountThisWeek !== b.attemptsCountThisWeek) {
      return a.attemptsCountThisWeek - b.attemptsCountThisWeek;
    }
    const timeDiff = new Date(a.achievedAt).getTime() - new Date(b.achievedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.pseudonym.localeCompare(b.pseudonym);
  });

  const maxItems = options.limit && options.limit > 0 ? options.limit : 25;

  return sorted.slice(0, maxItems).map((item, idx) => ({
    rank: idx + 1,
    pseudonym: item.pseudonym,
    courseId: item.courseId,
    courseTitle: item.courseTitle,
    subject: item.subject,
    assessmentId: item.assessmentId,
    assessmentTitle: item.assessmentTitle,
    bestScorePercent: item.bestScorePercent,
    attemptsCountThisWeek: item.attemptsCountThisWeek,
    passed: item.passed,
    achievedAt: item.achievedAt,
    isCurrentUser: Boolean(options.currentUserId && options.currentUserId === item.userId),
  }));
}

export function filterQuizLeaderboardEntriesByCourse(
  entries: QuizLeaderboardEntry[],
  courseId: string
): QuizLeaderboardEntry[] {
  const filtered =
    !courseId || courseId === 'all'
      ? entries
      : entries.filter((entry) => entry.courseId === courseId);

  return filtered.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

export function summarizeQuizLeaderboard(
  entries: QuizLeaderboardEntry[]
): QuizLeaderboardSummary {
  if (entries.length === 0) {
    return {
      topScorePercent: 0,
      averageScorePercent: 0,
      passRatePercent: 0,
      participantCount: 0,
    };
  }
  const topScorePercent = Math.max(...entries.map((e) => e.bestScorePercent));
  const totalScore = entries.reduce((sum, e) => sum + e.bestScorePercent, 0);
  const passedCount = entries.filter((e) => e.passed).length;

  return {
    topScorePercent,
    averageScorePercent: Math.round(totalScore / entries.length),
    passRatePercent: Math.round((passedCount / entries.length) * 100),
    participantCount: entries.length,
  };
}
