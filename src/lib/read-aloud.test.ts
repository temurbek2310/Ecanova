import assert from 'node:assert/strict';
import test from 'node:test';
import type { LessonPublic } from '../shared/types';
import {
  buildFullLessonReadAloudText,
  buildLessonReadAloudSegments,
  clampSpeechRate,
  resolveSpeechLocaleTag,
  sanitizeTextForSpeech,
  selectPreferredSpeechVoice,
} from './read-aloud';

const sampleLesson: LessonPublic = {
  id: 'les-econ-en-1',
  editionId: 'ed-econ-beg-en-v1',
  sequenceNum: 1,
  title: 'Why Prices Move: Demand & Supply Schedules',
  summary: 'Explore how buyers and sellers coordinate through market prices.',
  objectives: [
    'Define quantity demanded and quantity supplied.',
    'Identify equilibrium where $Q_d(P^*) = Q_s(P^*)$.',
  ],
  bodyBlocks: [
    {
      kind: 'concept',
      heading: 'The Law of Demand',
      body: 'Holding other factors constant, a higher price reduces quantity demanded.',
    },
    {
      kind: 'formula',
      heading: 'Market Clearing Condition',
      body: '$Q_d(P^*) = Q_s(P^*)$ as $P -> P^*$',
    },
  ],
  keyTerms: [
    {
      term: 'Market Equilibrium',
      definition: 'A state where quantity demanded equals quantity supplied.',
    },
  ],
  simulationType: 'supply_demand',
  videoUrl: null,
  captionsVtt: null,
  transcript: 'Full lesson transcript text.',
  estimatedMinutes: 15,
  isRequired: true,
  provenance: null,
};

test('sanitizeTextForSpeech strips math delimiters and converts symbols to spoken words', () => {
  const cleanedEn = sanitizeTextForSpeech('Equilibrium $Q_d(P^*) = Q_s(P^*)$ when $P >= 10$', 'en');
  assert.ok(!cleanedEn.includes('$'));
  assert.ok(cleanedEn.includes('equals'));
  assert.ok(cleanedEn.includes('greater than or equal to'));

  const cleanedUz = sanitizeTextForSpeech('$P -> P^*$ va $Q_d = Q_s$', 'uz');
  assert.ok(!cleanedUz.includes('$'));
  assert.ok(cleanedUz.includes('intiladi'));
  assert.ok(cleanedUz.includes('teng'));
});

test('buildLessonReadAloudSegments builds structured segments for intro, objectives, blocks, and key terms', () => {
  const segmentsEn = buildLessonReadAloudSegments(
    sampleLesson,
    'en',
    'Foundations of Microeconomics'
  );
  assert.equal(segmentsEn.length, 5);
  assert.deepEqual(
    segmentsEn.map((s) => s.id),
    ['intro', 'objectives', 'block-0', 'block-1', 'key-terms']
  );
  assert.equal(segmentsEn[0].lang, 'en-US');
  assert.ok(segmentsEn[0].text.includes('Foundations of Microeconomics'));
  assert.ok(segmentsEn[2].text.includes('The Law of Demand'));
  assert.ok(segmentsEn[3].text.includes('Formula:'));
  assert.ok(segmentsEn[4].text.includes('Market Equilibrium'));

  const segmentsUz = buildLessonReadAloudSegments(sampleLesson, 'uz', 'Mikroiqtisodiyot');
  assert.equal(segmentsUz[0].lang, 'uz-UZ');
  assert.ok(segmentsUz[0].text.includes('1-dars'));

  const fullText = buildFullLessonReadAloudText(sampleLesson, 'en');
  assert.ok(fullText.includes('Why Prices Move'));
  assert.ok(fullText.includes('Market Equilibrium'));
});

test('selectPreferredSpeechVoice and clampSpeechRate handle voice matching and rate bounds', () => {
  assert.equal(resolveSpeechLocaleTag('en'), 'en-US');
  assert.equal(resolveSpeechLocaleTag('uz'), 'uz-UZ');
  assert.equal(clampSpeechRate(1.25), 1.25);
  assert.equal(clampSpeechRate(0.1), 0.5);
  assert.equal(clampSpeechRate(4.0), 2);
  assert.equal(clampSpeechRate(Number.NaN), 1);

  const voices = [
    { name: 'English UK', lang: 'en-GB', default: false },
    { name: 'English US', lang: 'en-US', default: true },
    { name: 'Uzbek', lang: 'uz-UZ', default: false },
  ];
  assert.equal(selectPreferredSpeechVoice(voices, 'en')?.name, 'English US');
  assert.equal(selectPreferredSpeechVoice(voices, 'uz')?.name, 'Uzbek');
  assert.equal(selectPreferredSpeechVoice([], 'en'), null);
});
