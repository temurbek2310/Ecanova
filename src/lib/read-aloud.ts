import type { LessonPublic, LocaleCode } from '../shared/types';

export interface ReadAloudSegment {
  id: string;
  kind: 'intro' | 'objectives' | 'block' | 'key_terms' | 'transcript';
  blockIndex?: number;
  label: string;
  text: string;
  lang: string;
}

export interface SpeechVoiceLike {
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
}

export function resolveSpeechLocaleTag(locale: LocaleCode): string {
  return locale === 'uz' ? 'uz-UZ' : 'en-US';
}

export function clampSpeechRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(2, Math.max(0.5, Number(rate.toFixed(2))));
}

/**
 * Cleans inline mathematical notation, LaTeX delimiters, and symbols into
 * natural spoken phrasing for the Web Speech API (`SpeechSynthesisUtterance`).
 */
export function sanitizeTextForSpeech(rawText: string, locale: LocaleCode = 'en'): string {
  if (!rawText) return '';

  const equalsWord = locale === 'uz' ? ' teng ' : ' equals ';
  const arrowWord = locale === 'uz' ? ' intiladi ' : ' approaches ';
  const geWord = locale === 'uz' ? ' katta yoki teng ' : ' greater than or equal to ';
  const leWord = locale === 'uz' ? ' kichik yoki teng ' : ' less than or equal to ';

  return rawText
    .replace(/\$/g, ' ')
    .replace(/≥|>=/g, geWord)
    .replace(/≤|<=/g, leWord)
    .replace(/→|->/g, arrowWord)
    .replace(/=/g, equalsWord)
    .replace(/∫/g, locale === 'uz' ? ' integral ' : ' integral ')
    .replace(/∇/g, locale === 'uz' ? ' gradient ' : ' gradient ')
    .replace(/×/g, locale === 'uz' ? ' ko‘paytirilgan ' : ' times ')
    .replace(/−/g, locale === 'uz' ? ' minus ' : ' minus ')
    .replace(/\^(\*|\d+)/g, ' $1 ')
    .replace(/_\{([^}]+)\}/g, ' $1 ')
    .replace(/_([a-zA-Z0-9*]+)/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds an ordered list of Read Aloud segments from a lesson's structured content
 * so auditory learners can listen to the entire lesson or jump to specific sections.
 */
export function buildLessonReadAloudSegments(
  lesson: LessonPublic,
  locale: LocaleCode,
  courseTitle?: string
): ReadAloudSegment[] {
  const lang = resolveSpeechLocaleTag(locale);
  const segments: ReadAloudSegment[] = [];

  // 1. Lesson Header & Summary
  const introPrefix =
    locale === 'uz'
      ? `${courseTitle ? `${courseTitle}. ` : ''}${lesson.sequenceNum}-dars: ${lesson.title}.`
      : `${courseTitle ? `${courseTitle}. ` : ''}Lesson ${lesson.sequenceNum}: ${lesson.title}.`;
  const introText = sanitizeTextForSpeech(`${introPrefix} ${lesson.summary}`, locale);
  segments.push({
    id: 'intro',
    kind: 'intro',
    label: locale === 'uz' ? 'Kirish va qisqacha mazmun' : 'Introduction & Summary',
    text: introText,
    lang,
  });

  // 2. Learning Objectives
  if (lesson.objectives.length > 0) {
    const objHeader = locale === 'uz' ? 'O‘quv maqsadlari:' : 'Learning Objectives:';
    const objBody = lesson.objectives
      .map((obj, idx) => `${idx + 1}. ${sanitizeTextForSpeech(obj, locale)}`)
      .join(' ');
    segments.push({
      id: 'objectives',
      kind: 'objectives',
      label: locale === 'uz' ? 'O‘quv maqsadlari' : 'Learning Objectives',
      text: `${objHeader} ${objBody}`,
      lang,
    });
  }

  // 3. Structured Lesson Content Blocks
  lesson.bodyBlocks.forEach((block, idx) => {
    const prefix =
      block.kind === 'formula'
        ? locale === 'uz'
          ? 'Matematik ifoda:'
          : 'Formula:'
        : '';
    const spokenHeading = sanitizeTextForSpeech(block.heading, locale);
    const spokenBody = sanitizeTextForSpeech(block.body, locale);
    segments.push({
      id: `block-${idx}`,
      kind: 'block',
      blockIndex: idx,
      label: block.heading || (locale === 'uz' ? `${idx + 1}-qism` : `Section ${idx + 1}`),
      text: [spokenHeading, prefix, spokenBody].filter(Boolean).join('. '),
      lang,
    });
  });

  // 4. Key Terms & Definitions
  if (lesson.keyTerms.length > 0) {
    const termsHeader = locale === 'uz' ? 'Asosiy atamalar:' : 'Key Terms:';
    const termsBody = lesson.keyTerms
      .map(
        (kt) =>
          `${sanitizeTextForSpeech(kt.term, locale)}: ${sanitizeTextForSpeech(
            kt.definition,
            locale
          )}`
      )
      .join(' ');
    segments.push({
      id: 'key-terms',
      kind: 'key_terms',
      label: locale === 'uz' ? 'Asosiy atamalar' : 'Key Terms',
      text: `${termsHeader} ${termsBody}`,
      lang,
    });
  }

  return segments;
}

export function buildFullLessonReadAloudText(
  lesson: LessonPublic,
  locale: LocaleCode,
  courseTitle?: string
): string {
  return buildLessonReadAloudSegments(lesson, locale, courseTitle)
    .map((segment) => segment.text)
    .join(' ');
}

export function selectPreferredSpeechVoice<T extends SpeechVoiceLike>(
  voices: T[],
  locale: LocaleCode
): T | null {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const targetPrefix = locale === 'uz' ? 'uz' : 'en';
  const exactTag = resolveSpeechLocaleTag(locale).toLowerCase();

  const exactMatch = voices.find((v) => v.lang?.toLowerCase() === exactTag);
  if (exactMatch) return exactMatch;

  const prefixMatch = voices.find((v) => v.lang?.toLowerCase().startsWith(targetPrefix));
  if (prefixMatch) return prefixMatch;

  const defaultVoice = voices.find((v) => Boolean(v.default));
  return defaultVoice ?? voices[0] ?? null;
}
