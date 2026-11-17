import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMMAND_BAR_COMPACT_GEOMETRY,
  COMMAND_BAR_MOBILE_COMPACT_GEOMETRY,
  buildCommandBarActions,
  filterCommandBarActions,
  getCommandBarGeometry,
  isCommandBarShortcutEvent,
} from './command-bar';
import type { CourseCatalogItem } from '../shared/types';

function makeSampleCourse(id: string, subject: 'Economics' | 'Mathematics' | 'Business', title: string): CourseCatalogItem {
  return {
    id,
    slug: id,
    subject,
    level: 'Intermediate',
    estimatedMinutes: 60,
    topicTags: [subject, title],
    editions: {
      en: {
        id: `${id}-en`,
        courseId: id,
        locale: 'en',
        version: 1,
        title,
        subtitle: `${subject} track`,
        description: 'Rigorous curriculum',
        outcomes: ['Master key concepts'],
        prerequisites: [],
        completionRules: 'Pass assessment',
        passingScorePercent: 75,
        status: 'published',
        subjectReviewerId: null,
        languageReviewerId: null,
        rightsReviewerId: null,
        publishedAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        lessonCount: 4,
        lessonTitles: ['Intro', 'Core', 'Practice', 'Review'],
        estimatedMinutes: 60,
        provenance: null,
      },
      uz: null,
    },
  };
}

test('getCommandBarGeometry returns compact pill, mobile icon size, and clamped 600x400 expanded bounds', () => {
  assert.deepEqual(getCommandBarGeometry(false, 1440, 900), COMMAND_BAR_COMPACT_GEOMETRY);
  assert.deepEqual(getCommandBarGeometry(false, 390, 844), COMMAND_BAR_MOBILE_COMPACT_GEOMETRY);
  assert.deepEqual(getCommandBarGeometry(true, 1440, 900), {
    width: 600,
    height: 400,
    borderRadius: 14,
  });
  assert.deepEqual(getCommandBarGeometry(true, 390, 844), {
    width: 366,
    height: 400,
    borderRadius: 14,
  });
  assert.deepEqual(getCommandBarGeometry(true, 1440, 320), {
    width: 600,
    height: 288,
    borderRadius: 14,
  });
});

test('isCommandBarShortcutEvent detects Cmd+K and Ctrl+K and ignores modified/unrelated keys', () => {
  assert.equal(isCommandBarShortcutEvent({ key: 'k', metaKey: true }), true);
  assert.equal(isCommandBarShortcutEvent({ key: 'K', ctrlKey: true }), true);
  assert.equal(isCommandBarShortcutEvent({ key: 'k', metaKey: false, ctrlKey: false }), false);
  assert.equal(isCommandBarShortcutEvent({ key: 'k', metaKey: true, altKey: true }), false);
  assert.equal(isCommandBarShortcutEvent({ key: 'k', ctrlKey: true, repeat: true }), false);
  assert.equal(isCommandBarShortcutEvent({ key: 'g', metaKey: true }), false);
});

test('buildCommandBarActions and filterCommandBarActions provide core quick actions and course search', () => {
  const courses = [
    makeSampleCourse('macro-101', 'Economics', 'Macroeconomics & Monetary Flows'),
    makeSampleCourse('calc-101', 'Mathematics', 'Applied Calculus & Optima'),
  ];

  const actions = buildCommandBarActions({
    locale: 'en',
    theme: 'dark',
    courses,
  });

  assert.ok(actions.some((a) => a.label === "Translate to O'zbek"));
  assert.ok(actions.some((a) => a.label === 'Jump to Macroeconomics'));
  assert.ok(actions.some((a) => a.label === 'View Dashboard'));

  const uzFiltered = filterCommandBarActions(actions, 'translate');
  assert.equal(uzFiltered.length, 1);
  assert.equal(uzFiltered[0].id, 'switch-locale');

  const calcFiltered = filterCommandBarActions(actions, 'calculus');
  assert.equal(calcFiltered.length, 1);
  assert.equal(calcFiltered[0].kind.type, 'open-course');
});
