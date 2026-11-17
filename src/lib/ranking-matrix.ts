import type { LocaleCode, QuizLeaderboardEntry, Subject } from '../shared/types';

export interface RankingMatrixRow {
  key: string;
  rank: number;
  indexCode: string;
  pseudonym: string;
  isCurrentUser: boolean;
  subject: Subject;
  trackCode: 'ECON' | 'MATH' | 'BUS';
  courseId: string;
  courseTitle: string;
  assessmentTitle: string;
  accuracyPercent: number;
  accuracyText: string;
  attemptsCountThisWeek: number;
  efficiencyIndex: string;
  cadenceText: string;
  passed: boolean;
  statusCode: 'PASS' | 'RETRY';
  achievedAtIso: string;
  achievedUtcText: string;
}

export function getSubjectTrackCode(subject: Subject): 'ECON' | 'MATH' | 'BUS' {
  switch (subject) {
    case 'Economics':
      return 'ECON';
    case 'Mathematics':
      return 'MATH';
    case 'Business':
      return 'BUS';
  }
}

export function formatAchievedUtcStamp(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return '--/-- --:-- UTC';
  }
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  const hh = String(parsed.getUTCHours()).padStart(2, '0');
  const min = String(parsed.getUTCMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min} UTC`;
}

export function computeAccuracyEfficiencyIndex(
  bestScorePercent: number,
  attemptsCountThisWeek: number
): number {
  const clampedScore = Math.max(0, Math.min(100, Number(bestScorePercent) || 0));
  const safeAttempts = Math.max(1, Number(attemptsCountThisWeek) || 1);
  return Math.round((clampedScore / Math.sqrt(safeAttempts)) * 10) / 10;
}

export function buildRankingMatrixRows(
  entries: readonly QuizLeaderboardEntry[],
  locale: LocaleCode
): RankingMatrixRow[] {
  const isUz = locale === 'uz';

  return entries.map((entry, idx) => {
    const rankNum = entry.rank > 0 ? entry.rank : idx + 1;
    const accuracyPercent = Math.max(0, Math.min(100, Math.round(entry.bestScorePercent)));
    const attempts = Math.max(1, Math.round(entry.attemptsCountThisWeek));
    const efficiency = computeAccuracyEfficiencyIndex(accuracyPercent, attempts);

    const cadenceText =
      attempts === 1
        ? isUz
          ? '1 urinish · 1-urinishda'
          : '1 try · 1st-pass'
        : isUz
        ? `${attempts} urinish`
        : `${attempts} tries`;

    return {
      key: `${entry.pseudonym}-${entry.courseId}-${rankNum}`,
      rank: rankNum,
      indexCode: String(rankNum).padStart(2, '0'),
      pseudonym: entry.pseudonym,
      isCurrentUser: entry.isCurrentUser,
      subject: entry.subject,
      trackCode: getSubjectTrackCode(entry.subject),
      courseId: entry.courseId,
      courseTitle: entry.courseTitle,
      assessmentTitle: entry.assessmentTitle,
      accuracyPercent,
      accuracyText: `${accuracyPercent.toFixed(1)}%`,
      attemptsCountThisWeek: attempts,
      efficiencyIndex: efficiency.toFixed(1),
      cadenceText,
      passed: entry.passed,
      statusCode: entry.passed ? 'PASS' : 'RETRY',
      achievedAtIso: entry.achievedAt,
      achievedUtcText: formatAchievedUtcStamp(entry.achievedAt),
    };
  });
}
