import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWeaknessTopicMetrics,
  formatShortRadarLabel,
  resolveWeaknessRadarThemeTokens,
  STRONG_PERFORMANCE_THRESHOLD,
} from './weakness-radar';
import type { CourseCatalogItem, EnrollmentRecord } from '../shared/types';
import type { WeaknessAnalysisSummary } from './study-features';

function makeCourse(id: string, subject: 'Economics' | 'Mathematics' | 'Business'): CourseCatalogItem {
  return {
    id,
    slug: id,
    subject,
    level: 'Intermediate',
    estimatedMinutes: 180,
    topicTags: [`${subject} Core`],
    editions: {
      en: {
        id: `${id}-en`,
        courseId: id,
        locale: 'en',
        version: 1,
        title: `${subject} Foundations`,
        subtitle: 'Core analytical curriculum',
        description: 'Rigorous study path',
        outcomes: ['Master equilibrium'],
        prerequisites: [],
        completionRules: 'Complete lessons and pass assessment',
        passingScorePercent: 75,
        status: 'published',
        subjectReviewerId: null,
        languageReviewerId: null,
        rightsReviewerId: null,
        publishedAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        lessonCount: 4,
        lessonTitles: ['Foundations', 'Models', 'Elasticity', 'Synthesis'],
        estimatedMinutes: 180,
        provenance: null,
      },
      uz: {
        id: `${id}-uz`,
        courseId: id,
        locale: 'uz',
        version: 1,
        title: `${subject} asoslari`,
        subtitle: 'Asosiy tahliliy dastur',
        description: 'Tizimli o‘quv kursi',
        outcomes: ['Muvozanatni tushunish'],
        prerequisites: [],
        completionRules: 'Darslarni yakunlang va testdan o‘ting',
        passingScorePercent: 75,
        status: 'published',
        subjectReviewerId: null,
        languageReviewerId: null,
        rightsReviewerId: null,
        publishedAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        lessonCount: 4,
        lessonTitles: ['Asoslar', 'Modellar', 'Elastiklik', 'Xulosa'],
        estimatedMinutes: 180,
        provenance: null,
      },
    },
  };
}

test('buildWeaknessTopicMetrics produces 6 bounded radar axes with both weak and strong points', () => {
  const courses = [
    makeCourse('c-econ', 'Economics'),
    makeCourse('c-math', 'Mathematics'),
    makeCourse('c-biz', 'Business'),
  ];

  const enrollments: EnrollmentRecord[] = [
    {
      id: 'enr-1',
      courseId: 'c-econ',
      locale: 'en',
      journeyStatus: 'progressing',
      completedLessonIds: ['l1'],
      requiredLessonIds: ['l1', 'l2', 'l3', 'l4'],
      bestScorePercent: 52,
      passedAssessment: false,
      enrolledAt: '2026-01-01T00:00:00Z',
      completedAt: null,
      pausedAt: null,
    },
    {
      id: 'enr-2',
      courseId: 'c-biz',
      locale: 'en',
      journeyStatus: 'completed',
      completedLessonIds: ['b1', 'b2', 'b3', 'b4'],
      requiredLessonIds: ['b1', 'b2', 'b3', 'b4'],
      bestScorePercent: 91,
      passedAssessment: true,
      enrolledAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-10T00:00:00Z',
      pausedAt: null,
    },
  ];

  const analysis: WeaknessAnalysisSummary = {
    totalMissedPatterns: 3,
    hasRecordedQuizFailures: true,
    recommendations: [
      {
        id: 'weak-1',
        courseId: 'c-econ',
        courseTitle: 'Economics Foundations',
        subject: 'Economics',
        lessonIndex: 2,
        lessonTitle: 'Elasticity',
        weakTopicLabel: 'Price Elasticity of Demand',
        missedCount: 3,
        severity: 'high',
        diagnosticReason: 'Missed 3x in quiz attempts',
        lessonPreviewSummary: 'Preview summary',
        keyConcepts: ['Arc Elasticity'],
      },
      {
        id: 'weak-2',
        courseId: 'c-math',
        courseTitle: 'Mathematics Foundations',
        subject: 'Mathematics',
        lessonIndex: 1,
        lessonTitle: 'Models',
        weakTopicLabel: 'Lagrange Multipliers',
        missedCount: 1,
        severity: 'moderate',
        diagnosticReason: 'Missed 1x in quiz attempts',
        lessonPreviewSummary: 'Preview summary',
        keyConcepts: ['Constrained Optimization'],
      },
    ],
  };

  const metrics = buildWeaknessTopicMetrics({
    analysis,
    courses,
    enrollments,
    locale: 'en',
  });

  assert.equal(metrics.length, 6);
  for (const m of metrics) {
    assert.ok(m.scorePercent >= 10 && m.scorePercent <= 100);
    assert.equal(m.isStrong, m.scorePercent >= STRONG_PERFORMANCE_THRESHOLD);
    assert.ok(m.shortLabel.length > 0 && m.shortLabel.length <= 18);
  }

  const weakOne = metrics.find((m) => m.id === 'weak-1');
  const weakTwo = metrics.find((m) => m.id === 'weak-2');
  assert.ok(weakOne && weakTwo);
  assert.equal(weakOne.isStrong, false);
  assert.equal(weakTwo.isStrong, false);
  assert.ok(weakOne.scorePercent < weakTwo.scorePercent);

  const strongPoints = metrics.filter((m) => m.isStrong);
  assert.ok(strongPoints.length >= 3);
});

test('formatShortRadarLabel preserves concise readable labels without overflow or trailing connectors', () => {
  assert.equal(formatShortRadarLabel('Microeconomics', 18), 'Microeconomics');
  assert.equal(formatShortRadarLabel('Market Equilibrium & Elasticity', 18), 'Market Equilibrium');
  assert.equal(formatShortRadarLabel('Linear Algebra & Optimization', 16), 'Linear Algebra');
  const trimmed = formatShortRadarLabel('Intertemporal Macroeconomic Equilibrium Models', 18);
  assert.ok(trimmed.length <= 18);
});

test('resolveWeaknessRadarThemeTokens returns distinct high-contrast SVG colors for light and dark themes', () => {
  const darkTokens = resolveWeaknessRadarThemeTokens('dark');
  assert.equal(darkTokens.polarGridStroke, '#222B3D');
  assert.equal(darkTokens.angleTickFill, '#E2E8F0');
  assert.equal(darkTokens.radarStroke, '#5DE1D2');

  const lightTokens = resolveWeaknessRadarThemeTokens('light');
  assert.equal(lightTokens.polarGridStroke, '#E5E7EB');
  assert.equal(lightTokens.angleTickFill, '#111827');
  assert.equal(lightTokens.radarStroke, '#0F766E');
});

