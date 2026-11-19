import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BADGE_SLIDE_IN_DEFAULTS,
  annotateBadgesForEntrance,
  buildBadgeEntranceAnimationPlan,
  buildBadgePopVariants,
  computeBadgeStaggerDelay,
  resolveNewlyUnlockedBadgeIds,
} from './badge-entrance';
import {
  buildAutoSubmitAnswersPayload,
  buildQuestionSlideState,
  computeAssessmentTimerDurationSeconds,
  computeQuestionNavigationTarget,
  computeQuestionSlideDelay,
  evaluateAssessmentProgress,
  evaluateCountdownUrgency,
  formatCountdownClock,
} from '../components/AssessmentView';
import {
  getKeyboardShortcutCheatSheet,
  isCheatSheetShortcutEvent,
} from './keyboard-shortcuts';
import {
  analyzeWeaknessDetection,
  appendDictatedTranscriptToMarkdown,
  resolveLessonNoteFromMap,
  resolveSpeechRecognitionLang,
  saveWeaknessConceptsToQuickNotes,
  toggleExpandedRecommendationId,
} from './study-features';
import { resolveEffectiveTheme, resolveThemeSyncOsFlag } from './theme';
import type { BadgeAward, CourseCatalogItem } from '../shared/types';

test('computeBadgeStaggerDelay increases monotonically and clamps at max delay', () => {
  assert.equal(computeBadgeStaggerDelay(0), 0.03);
  assert.equal(computeBadgeStaggerDelay(1), 0.095);
  assert.equal(computeBadgeStaggerDelay(2), 0.16);
  assert.equal(computeBadgeStaggerDelay(-5), 0.03);
  assert.equal(computeBadgeStaggerDelay(100), 0.45);
});

test('buildBadgePopVariants returns spring pop-in states from scale 0.86 to 1', () => {
  const variants = buildBadgePopVariants(2);
  assert.equal(variants.hidden.opacity, 0);
  assert.equal(variants.hidden.scale, 0.86);
  assert.equal(variants.hidden.y, 12);

  assert.equal(variants.visible.opacity, 1);
  assert.equal(variants.visible.scale, 1);
  assert.equal(variants.visible.y, 0);
  assert.equal(variants.visible.transition.type, 'spring');
  assert.equal(variants.visible.transition.delay, 0.16);

  assert.equal(variants.hover.scale, 1.015);
  assert.equal(variants.hover.y, -2);
});

test('annotateBadgesForEntrance annotates stagger delays and recent awards', () => {
  const nowMs = Date.parse('2026-11-17T10:00:00Z');
  const sampleBadges: BadgeAward[] = [
    {
      id: 'badge-1',
      badgeKey: 'FIRST_LESSON',
      title: 'First Lesson Complete',
      criteria: 'Complete your first required lesson.',
      awardedAt: '2026-11-17T08:00:00Z',
    },
    {
      id: 'badge-2',
      badgeKey: 'STREAK_7',
      title: '7-Day Study Streak',
      criteria: 'Maintain a 7-day learning streak.',
      awardedAt: '2026-11-01T08:00:00Z',
    },
  ];

  const annotated = annotateBadgesForEntrance(sampleBadges, nowMs);
  assert.equal(annotated.length, 2);
  assert.equal(annotated[0].isRecentAward, true);
  assert.equal(annotated[0].staggerDelaySec, 0.03);
  assert.equal(annotated[1].isRecentAward, false);
  assert.equal(annotated[1].staggerDelaySec, 0.095);
});

test('resolveNewlyUnlockedBadgeIds and buildBadgeEntranceAnimationPlan target staggered power3.out fade+scale transitions', () => {
  const initialBadges: BadgeAward[] = [
    {
      id: 'badge-1',
      badgeKey: 'FIRST_LESSON',
      title: 'First Lesson Complete',
      criteria: 'Complete your first required lesson.',
      awardedAt: '2026-11-17T08:00:00Z',
    },
  ];
  const updatedBadges: BadgeAward[] = [
    ...initialBadges,
    {
      id: 'badge-2',
      badgeKey: 'MACRO_MASTER',
      title: 'Macro Stabilization Master',
      criteria: 'Pass the Macro Stabilization assessment.',
      awardedAt: '2026-11-18T08:00:00Z',
    },
  ];

  assert.deepEqual(resolveNewlyUnlockedBadgeIds(['badge-1'], initialBadges), []);
  assert.deepEqual(resolveNewlyUnlockedBadgeIds(['badge-1'], updatedBadges), ['badge-2']);
  assert.deepEqual(resolveNewlyUnlockedBadgeIds([], updatedBadges), ['badge-1', 'badge-2']);
  assert.equal(BADGE_SLIDE_IN_DEFAULTS.ease, 'power3.out');
  assert.ok(BADGE_SLIDE_IN_DEFAULTS.initialScale < 1 && BADGE_SLIDE_IN_DEFAULTS.initialScale > 0.8);
  assert.ok(BADGE_SLIDE_IN_DEFAULTS.unlockScale < 1);
  assert.ok(BADGE_SLIDE_IN_DEFAULTS.staggerSec > 0);

  const initialPlan = buildBadgeEntranceAnimationPlan({
    hasHydratedBaseline: false,
    previousBadgeIds: [],
    currentBadges: updatedBadges,
  });
  assert.equal(initialPlan.mode, 'initial-stagger');
  assert.deepEqual(initialPlan.targetIds, ['badge-1', 'badge-2']);
  assert.equal(initialPlan.ease, 'power3.out');

  const unlockPlan = buildBadgeEntranceAnimationPlan({
    hasHydratedBaseline: true,
    previousBadgeIds: ['badge-1'],
    currentBadges: updatedBadges,
  });
  assert.equal(unlockPlan.mode, 'unlock-stagger');
  assert.deepEqual(unlockPlan.targetIds, ['badge-2']);
  assert.equal(unlockPlan.ease, 'power3.out');

  const emptyPlan = buildBadgeEntranceAnimationPlan({
    hasHydratedBaseline: false,
    previousBadgeIds: [],
    currentBadges: [],
  });
  assert.equal(emptyPlan.mode, 'none');
});

test('buildQuestionSlideState and computeQuestionSlideDelay produce directional sequential slide states', () => {
  assert.equal(computeQuestionSlideDelay(0), 0.04);
  assert.equal(computeQuestionSlideDelay(2), 0.19);
  assert.equal(computeQuestionSlideDelay(50), 0.48);

  const forwardSlide = buildQuestionSlideState(1, 'forward');
  assert.equal(forwardSlide.initial.x, 28);
  assert.equal(forwardSlide.exit.x, -24);
  assert.equal(forwardSlide.animate.x, 0);
  assert.equal(forwardSlide.animate.transition.delay, 0.115);

  const backwardSlide = buildQuestionSlideState(1, 'backward');
  assert.equal(backwardSlide.initial.x, -28);
  assert.equal(backwardSlide.exit.x, 24);
});

test('evaluateAssessmentProgress tracks answered progress and submission score transitions', () => {
  const qIds = ['q1', 'q2', 'q3', 'q4'];
  const partial = evaluateAssessmentProgress(qIds, { q1: 0, q2: 2 });
  assert.equal(partial.answeredCount, 2);
  assert.equal(partial.completionPercent, 50);
  assert.equal(partial.status, 'in_progress');

  const ready = evaluateAssessmentProgress(qIds, { q1: 0, q2: 2, q3: 1, q4: 3 });
  assert.equal(ready.isAllAnswered, true);
  assert.equal(ready.completionPercent, 100);
  assert.equal(ready.status, 'ready_to_submit');

  const submitted = evaluateAssessmentProgress(
    qIds,
    { q1: 0, q2: 2, q3: 1, q4: 3 },
    { scorePercent: 75, passed: true }
  );
  assert.equal(submitted.displayPercent, 75);
  assert.equal(submitted.status, 'submitted_passed');
});

test('computeQuestionNavigationTarget clamps bounds and determines slide direction', () => {
  assert.deepEqual(computeQuestionNavigationTarget(0, 4, 'next'), {
    nextIndex: 1,
    direction: 'forward',
  });
  assert.deepEqual(computeQuestionNavigationTarget(2, 4, 'prev'), {
    nextIndex: 1,
    direction: 'backward',
  });
  assert.deepEqual(computeQuestionNavigationTarget(3, 4, 'next'), {
    nextIndex: 3,
    direction: 'forward',
  });
});

test('assessment countdown timer helpers compute duration, format clock, and build auto-submit payload', () => {
  assert.equal(computeAssessmentTimerDurationSeconds(4), 360);
  assert.equal(computeAssessmentTimerDurationSeconds(1), 120);
  assert.equal(formatCountdownClock(300), '05:00');
  assert.equal(formatCountdownClock(65), '01:05');
  assert.equal(formatCountdownClock(0), '00:00');

  assert.equal(evaluateCountdownUrgency(180, 300), 'normal');
  assert.equal(evaluateCountdownUrgency(45, 300), 'warning');
  assert.equal(evaluateCountdownUrgency(20, 300), 'critical');
  assert.equal(evaluateCountdownUrgency(0, 300), 'expired');

  const autoPayload = buildAutoSubmitAnswersPayload(['q1', 'q2', 'q3'], { q1: 2, q3: 1 });
  assert.deepEqual(autoPayload, {
    q1: 2,
    q2: -1,
    q3: 1,
  });
});

test('voice-to-text helpers format markdown notes and resolve locale BCP-47 speech codes', () => {
  assert.equal(resolveSpeechRecognitionLang('en'), 'en-US');
  assert.equal(resolveSpeechRecognitionLang('uz'), 'uz-UZ');
  assert.equal(appendDictatedTranscriptToMarkdown('', 'supply and demand equilibrium'), '- supply and demand equilibrium');
  assert.equal(
    appendDictatedTranscriptToMarkdown('# Notes\n', 'marginal cost equals marginal revenue'),
    '# Notes\n- marginal cost equals marginal revenue'
  );
});

test('keyboard shortcut cheat sheet detects Shift+? and lists G, C, P shortcuts', () => {
  assert.equal(
    isCheatSheetShortcutEvent({
      key: '?',
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      repeat: false,
      defaultPrevented: false,
      isEditableTarget: false,
    }),
    true
  );
  assert.equal(
    isCheatSheetShortcutEvent({
      key: '?',
      shiftKey: false,
      isEditableTarget: true,
    }),
    false
  );

  const items = getKeyboardShortcutCheatSheet('en', false);
  const keyLabels = items.map((i) => i.keys.join(' + '));
  assert.ok(keyLabels.includes('G'));
  assert.ok(keyLabels.includes('C'));
  assert.ok(keyLabels.includes('P'));
  assert.ok(keyLabels.includes('Shift + ?'));
});

test('OS theme preference sync resolves effective theme with manual override support', () => {
  assert.equal(resolveThemeSyncOsFlag('true'), true);
  assert.equal(resolveThemeSyncOsFlag('false'), false);
  assert.equal(
    resolveEffectiveTheme({ syncWithOs: true, manualTheme: 'dark', systemTheme: 'light' }),
    'light'
  );
  assert.equal(
    resolveEffectiveTheme({ syncWithOs: false, manualTheme: 'dark', systemTheme: 'light' }),
    'dark'
  );
});

test('analyzeWeaknessDetection recommends specific lessons from missed quiz patterns or active courses', () => {
  const sampleCourses = [
    {
      id: 'course-econ-101',
      slug: 'microeconomics-foundations',
      subject: 'Economics',
      level: 'Beginner',
      estimatedMinutes: 90,
      editions: {
        en: {
          locale: 'en',
          title: 'Microeconomic Foundations',
          subtitle: 'Supply, Demand, and Market Equilibrium',
          description: 'Core microeconomic principles.',
          outcomes: ['Analyze price elasticity'],
          lessonCount: 2,
          lessonTitles: ['Elasticity & Price Signals', 'Consumer Surplus & Welfare'],
        },
        uz: null,
      },
    },
  ] as unknown as CourseCatalogItem[];

  const summary = analyzeWeaknessDetection({
    courses: sampleCourses,
    enrollments: [],
    locale: 'en',
    weaknessHistory: [
      {
        courseId: 'course-econ-101',
        assessmentId: 'assess-1',
        questionId: 'q-elast-1',
        questionSequenceNum: 1,
        objectiveRef: 'Price Elasticity',
        prompt: 'How does price elasticity affect total revenue along a demand curve?',
        missedCount: 2,
        lastMissedAt: '2026-11-17T08:00:00Z',
      },
    ],
  });

  assert.equal(summary.hasRecordedQuizFailures, true);
  assert.equal(summary.totalMissedPatterns, 2);
  assert.ok(summary.recommendations.length >= 1);
  assert.equal(summary.recommendations[0].courseId, 'course-econ-101');
  assert.equal(summary.recommendations[0].lessonTitle, 'Elasticity & Price Signals');
  assert.ok(summary.recommendations[0].lessonPreviewSummary.includes('Elasticity & Price Signals'));
  assert.ok(summary.recommendations[0].keyConcepts.includes('Price Elasticity'));
  assert.ok(summary.recommendations[0].keyConcepts.includes('Analyze price elasticity'));

  const expandedOnce = toggleExpandedRecommendationId([], summary.recommendations[0].id);
  assert.deepEqual(expandedOnce, [summary.recommendations[0].id]);
  const collapsedAgain = toggleExpandedRecommendationId(expandedOnce, summary.recommendations[0].id);
  assert.deepEqual(collapsedAgain, []);

  const savedResult = saveWeaknessConceptsToQuickNotes({
    recommendation: summary.recommendations[0],
    existingNotes: {},
    targetLessonId: 'les-econ-1',
    locale: 'en',
  });
  assert.equal(savedResult.noteKey, 'course-econ-101:les-econ-1');
  assert.ok(savedResult.markdownBlock.includes('## Key Concepts: Elasticity & Price Signals'));
  assert.ok(savedResult.markdownBlock.includes('- Price Elasticity'));

  const resolvedNote = resolveLessonNoteFromMap(savedResult.updatedNotes, {
    courseId: 'course-econ-101',
    lessonId: 'les-econ-1',
    lessonTitle: 'Elasticity & Price Signals',
  });
  assert.ok(resolvedNote.includes('## Key Concepts: Elasticity & Price Signals'));
});

