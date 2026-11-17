import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWeeklyStudyDigest,
  evaluateStreakFlameState,
  makeLessonNoteKey,
  mergeLessonNotesMaps,
  parseSimpleMarkdownBlocks,
  segmentTextWithGlossaryTerms,
} from './study-features';

test('buildWeeklyStudyDigest summarizes XP and completed courses over the last 7 days', () => {
  const now = new Date('2026-03-15T12:00:00.000Z');
  const digest = buildWeeklyStudyDigest({
    now,
    locale: 'en',
    xpLedger: [
      {
        id: 'xp-1',
        eventType: 'lesson_completed',
        referenceId: 'les-1',
        amount: 25,
        status: 'valid',
        ruleVersion: 'v1',
        description: 'Lesson 1',
        createdAt: '2026-03-14T10:00:00.000Z',
      },
      {
        id: 'xp-2',
        eventType: 'course_completed',
        referenceId: 'course-1',
        amount: 100,
        status: 'valid',
        ruleVersion: 'v1',
        description: 'Course 1',
        createdAt: '2026-03-12T09:00:00.000Z',
      },
      {
        id: 'xp-old',
        eventType: 'lesson_completed',
        referenceId: 'les-old',
        amount: 25,
        status: 'valid',
        ruleVersion: 'v1',
        description: 'Old Lesson',
        createdAt: '2026-02-20T09:00:00.000Z',
      },
    ],
    enrollments: [
      {
        id: 'enr-1',
        courseId: 'course-econ-beg',
        locale: 'en',
        journeyStatus: 'completed',
        completedLessonIds: ['l1', 'l2'],
        requiredLessonIds: ['l1', 'l2'],
        bestScorePercent: 100,
        passedAssessment: true,
        enrolledAt: '2026-03-10T08:00:00.000Z',
        completedAt: '2026-03-12T09:00:00.000Z',
        pausedAt: null,
      },
    ],
    courses: [
      {
        id: 'course-econ-beg',
        slug: 'supply-demand',
        subject: 'Economics',
        level: 'Beginner',
        estimatedMinutes: 45,
        editions: {
          en: {
            id: 'ed-1',
            courseId: 'course-econ-beg',
            locale: 'en',
            version: 1,
            title: 'Foundations of Supply, Demand & Market Equilibrium',
            subtitle: '',
            description: '',
            outcomes: [],
            prerequisites: [],
            completionRules: '',
            passingScorePercent: 70,
            status: 'published',
            subjectReviewerId: null,
            languageReviewerId: null,
            rightsReviewerId: null,
            publishedAt: null,
            updatedAt: '2026-03-01T00:00:00.000Z',
            lessonCount: 2,
            estimatedMinutes: 45,
            provenance: null,
          },
          uz: null,
        },
      },
    ],
  });

  assert.equal(digest.weeklyXpEarned, 125);
  assert.equal(digest.weeklyEventsCount, 2);
  assert.equal(digest.activeDaysCount, 2);
  assert.equal(digest.completedCoursesCount, 1);
  assert.equal(
    digest.completedCourses[0].title,
    'Foundations of Supply, Demand & Market Equilibrium'
  );
});

test('evaluateStreakFlameState glows when daily milestone or streak is active', () => {
  const cold = evaluateStreakFlameState({
    currentStreak: 0,
    xpToday: 0,
    studyMinutesToday: 0,
    dailyStudyGoalMinutes: 30,
  });
  assert.equal(cold.isMilestoneGlowing, false);

  const glowingByXp = evaluateStreakFlameState({
    currentStreak: 1,
    xpToday: 25,
    studyMinutesToday: 15,
    dailyStudyGoalMinutes: 30,
  });
  assert.equal(glowingByXp.isMilestoneGlowing, true);
  assert.equal(glowingByXp.earnedXpToday, true);
});

test('segmentTextWithGlossaryTerms identifies interactive economic and math terms', () => {
  const segments = segmentTextWithGlossaryTerms(
    'When Market Equilibrium holds, Quantity Demanded equals Quantity Supplied.',
    [
      {
        term: 'Market Equilibrium',
        definition: 'Price clearing state where demand equals supply.',
      },
      {
        term: 'Quantity Demanded',
        definition: 'Units demanded by buyers at a given price.',
      },
    ]
  );

  const termSegments = segments.filter((s) => s.kind === 'term');
  assert.equal(termSegments.length, 2);
  assert.equal(termSegments[0].text, 'Market Equilibrium');
  assert.equal(termSegments[1].text, 'Quantity Demanded');
});

test('Quick Notes helpers format keys, merge maps, and parse Markdown blocks', () => {
  const key = makeLessonNoteKey('course-econ-beg', 'lesson-1');
  assert.equal(key, 'course-econ-beg:lesson-1');

  const merged = mergeLessonNotesMaps(
    { 'course-econ-beg:lesson-1': '# Local Updated Note' },
    {
      'course-econ-beg:lesson-1': '# Older Profile Note',
      'course-math:lesson-2': '- Matrix Eigenvalues',
    }
  );
  assert.equal(merged['course-econ-beg:lesson-1'], '# Local Updated Note');
  assert.equal(merged['course-math:lesson-2'], '- Matrix Eigenvalues');

  const blocks = parseSimpleMarkdownBlocks('# Heading\n- Bullet item\n> Quote line\nPlain text');
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ['h1', 'bullet', 'quote', 'paragraph']
  );
});
