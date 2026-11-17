import type {
  CourseCatalogItem,
  EnrollmentRecord,
  LocaleCode,
  Subject,
} from '../shared/types';
import type {
  WeaknessAnalysisSummary,
  WeaknessLessonRecommendation,
} from './study-features';

export const STRONG_PERFORMANCE_THRESHOLD = 70;

export interface WeaknessTopicMetric {
  id: string;
  topic: string;
  shortLabel: string;
  subject: Subject;
  scorePercent: number;
  isStrong: boolean;
  missedCount: number;
  courseId?: string;
  courseTitle?: string;
  recommendation?: WeaknessLessonRecommendation;
  statusLabel: string;
}

interface PillarTemplate {
  key: string;
  subject: Subject;
  enTopic: string;
  uzTopic: string;
  enShort: string;
  uzShort: string;
  baseStrongScore: number;
}

const CORE_PILLARS: PillarTemplate[] = [
  {
    key: 'microeconomics',
    subject: 'Economics',
    enTopic: 'Microeconomics & Equilibrium',
    uzTopic: 'Mikroiqtisodiyot va muvozanat',
    enShort: 'Microeconomics',
    uzShort: 'Mikroiqtisodiyot',
    baseStrongScore: 84,
  },
  {
    key: 'algebra',
    subject: 'Mathematics',
    enTopic: 'Linear Algebra & Matrices',
    uzTopic: 'Chiziqli algebra va matritsalar',
    enShort: 'Algebra',
    uzShort: 'Algebra',
    baseStrongScore: 81,
  },
  {
    key: 'market-analysis',
    subject: 'Economics',
    enTopic: 'Market Elasticity & Welfare',
    uzTopic: 'Bozor elastikligi va farovonlik',
    enShort: 'Market Analysis',
    uzShort: 'Bozor tahlili',
    baseStrongScore: 78,
  },
  {
    key: 'unit-economics',
    subject: 'Business',
    enTopic: 'Unit Economics & LTV/CAC',
    uzTopic: 'Birlik iqtisodiyoti (LTV/CAC)',
    enShort: 'Unit Economics',
    uzShort: 'Birlik iqtisod.',
    baseStrongScore: 88,
  },
  {
    key: 'calculus',
    subject: 'Mathematics',
    enTopic: 'Multivariable Calculus & Optima',
    uzTopic: 'Ko‘p o‘zgaruvchili tahlil',
    enShort: 'Calculus',
    uzShort: 'Mat. tahlil',
    baseStrongScore: 76,
  },
  {
    key: 'capital-strategy',
    subject: 'Business',
    enTopic: 'Capital Allocation & Risk',
    uzTopic: 'Kapital taqsimoti va risk',
    enShort: 'Capital Strategy',
    uzShort: 'Kapital riski',
    baseStrongScore: 85,
  },
];

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(10, Math.min(100, Math.round(value)));
}

export function formatShortRadarLabel(raw: string, maxLen = 18): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const stripTrailingConnector = (value: string) =>
    value.replace(/[\s,&/:-]+$/g, '').trim();

  if (cleaned.length <= maxLen) return stripTrailingConnector(cleaned);
  const words = cleaned.split(' ');
  let acc = '';
  for (const w of words) {
    const candidate = acc ? `${acc} ${w}` : w;
    if (candidate.length <= maxLen) {
      acc = candidate;
    } else {
      break;
    }
  }
  const trimmed = stripTrailingConnector(acc);
  if (trimmed.length >= 6) return trimmed;
  return `${stripTrailingConnector(cleaned.slice(0, maxLen - 1))}…`;
}

function isNearDuplicateLabel(candidate: string, existingSet: Set<string>): boolean {
  const lower = candidate.toLowerCase();
  if (existingSet.has(lower)) return true;
  for (const existing of existingSet) {
    if (
      (lower.includes('market') && existing.includes('market')) ||
      (lower.includes('algebra') && existing.includes('algebra')) ||
      (lower.includes('microecon') && existing.includes('microecon'))
    ) {
      return true;
    }
  }
  return false;
}

function deriveWeaknessScore(
  rec: WeaknessLessonRecommendation,
  index: number,
  enrollmentByCourse: Map<string, EnrollmentRecord>
): number {
  if (rec.missedCount > 0) {
    // Higher miss count drops proficiency lower into the Purple weakness band (< 70%)
    return clampPercent(Math.max(24, 62 - rec.missedCount * 10 - index * 3));
  }
  const enr = enrollmentByCourse.get(rec.courseId);
  if (enr && typeof enr.bestScorePercent === 'number' && !enr.passedAssessment) {
    return clampPercent(Math.min(64, Math.max(28, enr.bestScorePercent)));
  }
  // Proactive diagnostic focus baseline inside the weakness band (< 70%)
  const baselineWeakScores = [46, 54, 61];
  return baselineWeakScores[index % baselineWeakScores.length];
}

export function buildWeaknessTopicMetrics(params: {
  analysis: WeaknessAnalysisSummary;
  courses: CourseCatalogItem[];
  enrollments: EnrollmentRecord[];
  locale: LocaleCode;
}): WeaknessTopicMetric[] {
  const isUz = params.locale === 'uz';
  const courseById = new Map(params.courses.map((c) => [c.id, c]));
  const enrollmentByCourse = new Map(params.enrollments.map((e) => [e.courseId, e]));

  const metrics: WeaknessTopicMetric[] = [];
  const usedShortLabels = new Set<string>();
  const coveredSubjectsWeakCount: Record<Subject, number> = {
    Economics: 0,
    Mathematics: 0,
    Business: 0,
  };

  // 1. Add active weakness recommendations first so Radar and List view stay 1:1 with action items
  params.analysis.recommendations.forEach((rec, index) => {
    const scorePercent = deriveWeaknessScore(rec, index, enrollmentByCourse);
    const isStrong = scorePercent >= STRONG_PERFORMANCE_THRESHOLD;
    let shortLabel = formatShortRadarLabel(rec.weakTopicLabel, 18);
    if (usedShortLabels.has(shortLabel.toLowerCase())) {
      shortLabel = formatShortRadarLabel(`${rec.subject.slice(0, 4)} · ${rec.weakTopicLabel}`, 18);
    }
    usedShortLabels.add(shortLabel.toLowerCase());
    coveredSubjectsWeakCount[rec.subject] += 1;

    metrics.push({
      id: rec.id,
      topic: rec.weakTopicLabel,
      shortLabel,
      subject: rec.subject,
      scorePercent,
      isStrong,
      missedCount: rec.missedCount,
      courseId: rec.courseId,
      courseTitle: rec.courseTitle,
      recommendation: rec,
      statusLabel: isStrong
        ? isUz
          ? 'Kuchli'
          : 'Strong'
        : isUz
        ? 'Zaif nuqta'
        : 'Weakness',
    });
  });

  // 2. Complement with strong mastery pillars from enrollments/catalog up to 6 axes
  for (const pillar of CORE_PILLARS) {
    if (metrics.length >= 6) break;
    const shortLabel = isUz ? pillar.uzShort : pillar.enShort;
    if (isNearDuplicateLabel(shortLabel, usedShortLabels)) continue;

    // Look for a matching enrollment in the same subject to ground score in real learner progress
    const matchingCourse = params.courses.find(
      (c) =>
        c.subject === pillar.subject &&
        !metrics.some((m) => m.courseId === c.id)
    );
    const matchingEnrollment = matchingCourse
      ? enrollmentByCourse.get(matchingCourse.id)
      : params.enrollments.find((e) => {
          const c = courseById.get(e.courseId);
          return c?.subject === pillar.subject && !metrics.some((m) => m.courseId === e.courseId);
        });

    let scorePercent = pillar.baseStrongScore;
    if (matchingEnrollment) {
      if (matchingEnrollment.passedAssessment) {
        scorePercent = clampPercent(Math.max(78, matchingEnrollment.bestScorePercent ?? 88));
      } else if (matchingEnrollment.requiredLessonIds.length > 0) {
        const ratio =
          matchingEnrollment.completedLessonIds.length /
          matchingEnrollment.requiredLessonIds.length;
        scorePercent = clampPercent(Math.max(72, Math.round(72 + ratio * 20)));
      }
    }

    usedShortLabels.add(shortLabel.toLowerCase());
    const courseEdition = matchingCourse
      ? matchingCourse.editions[params.locale] ?? matchingCourse.editions.en
      : undefined;

    metrics.push({
      id: `pillar-${pillar.key}`,
      topic: isUz ? pillar.uzTopic : pillar.enTopic,
      shortLabel,
      subject: pillar.subject,
      scorePercent,
      isStrong: scorePercent >= STRONG_PERFORMANCE_THRESHOLD,
      missedCount: 0,
      courseId: matchingCourse?.id,
      courseTitle: courseEdition?.title,
      statusLabel: isUz ? 'Kuchli' : 'Strong',
    });
  }

  return metrics;
}

export interface WeaknessRadarThemeTokens {
  polarGridStroke: string;
  angleTickFill: string;
  radarStroke: string;
  radarFill: string;
  radarFillOpacity: number;
  dotStroke: string;
  activeDotFill: string;
  activeDotStroke: string;
  tooltipCursorStroke: string;
  strongMetricHex: string;
  weakMetricHex: string;
}

export function resolveWeaknessRadarThemeTokens(
  theme: 'light' | 'dark'
): WeaknessRadarThemeTokens {
  if (theme === 'light') {
    return {
      polarGridStroke: '#E5E7EB',
      angleTickFill: '#111827',
      radarStroke: '#0F766E',
      radarFill: '#14B8A6',
      radarFillOpacity: 0.22,
      dotStroke: '#FFFFFF',
      activeDotFill: '#6D28D9',
      activeDotStroke: '#0F766E',
      tooltipCursorStroke: '#6D28D9',
      strongMetricHex: '#047857',
      weakMetricHex: '#6D28D9',
    };
  }

  return {
    polarGridStroke: '#222B3D',
    angleTickFill: '#E2E8F0',
    radarStroke: '#5DE1D2',
    radarFill: '#5DE1D2',
    radarFillOpacity: 0.22,
    dotStroke: '#080B14',
    activeDotFill: '#9274FF',
    activeDotStroke: '#5DE1D2',
    tooltipCursorStroke: '#9274FF',
    strongMetricHex: '#6FE0A1',
    weakMetricHex: '#9274FF',
  };
}

