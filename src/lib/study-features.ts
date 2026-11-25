import type {
  CourseCatalogItem,
  EnrollmentRecord,
  GlossaryTermItem,
  KeyTerm,
  LocaleCode,
  XpLedgerEntry,
} from '../shared/types';

export interface WeeklyStudyDigestSummary {
  windowStartIso: string;
  windowEndIso: string;
  weeklyXpEarned: number;
  weeklyEventsCount: number;
  activeDaysCount: number;
  completedCoursesCount: number;
  completedCourses: Array<{
    courseId: string;
    title: string;
    subject: string;
    completedAt: string;
  }>;
}

/**
 * Computes the Weekly Study Digest over the last 7 days (total valid XP and completed courses).
 */
export function buildWeeklyStudyDigest(params: {
  xpLedger: readonly XpLedgerEntry[];
  enrollments: readonly EnrollmentRecord[];
  courses: readonly CourseCatalogItem[];
  locale: LocaleCode;
  now?: Date;
}): WeeklyStudyDigestSummary {
  const now = params.now ?? new Date();
  const endMs = now.getTime();
  const startMs = endMs - 7 * 24 * 60 * 60 * 1000;

  let weeklyXpEarned = 0;
  let weeklyEventsCount = 0;
  const activeDayKeys = new Set<string>();

  for (const entry of params.xpLedger) {
    if (entry.status !== 'valid' || entry.amount <= 0) continue;
    const ts = Date.parse(entry.createdAt);
    if (Number.isNaN(ts) || ts < startMs || ts > endMs + 60_000) continue;
    weeklyXpEarned += entry.amount;
    weeklyEventsCount += 1;
    activeDayKeys.add(entry.createdAt.slice(0, 10));
  }

  const courseById = new Map<string, CourseCatalogItem>();
  for (const c of params.courses) {
    courseById.set(c.id, c);
  }

  const completedCourses: WeeklyStudyDigestSummary['completedCourses'] = [];
  for (const enr of params.enrollments) {
    if (enr.journeyStatus !== 'completed') continue;
    const completedStamp = enr.completedAt || enr.enrolledAt;
    const ts = Date.parse(completedStamp);
    if (Number.isNaN(ts) || ts < startMs || ts > endMs + 60_000) continue;
    const course = courseById.get(enr.courseId);
    const title =
      course?.editions[params.locale]?.title ||
      course?.editions.en?.title ||
      course?.slug ||
      enr.courseId;
    completedCourses.push({
      courseId: enr.courseId,
      title,
      subject: course?.subject || 'Economics',
      completedAt: completedStamp,
    });
  }

  return {
    windowStartIso: new Date(startMs).toISOString(),
    windowEndIso: now.toISOString(),
    weeklyXpEarned,
    weeklyEventsCount,
    activeDaysCount: activeDayKeys.size,
    completedCoursesCount: completedCourses.length,
    completedCourses,
  };
}

export interface StreakFlameState {
  isMilestoneGlowing: boolean;
  streakDays: number;
  dailyGoalReached: boolean;
  earnedXpToday: boolean;
  tooltip: string;
}

/**
 * Evaluates the visual 'Streak Flame' indicator in the navigation menu next to Overview.
 * Glows when a user hits a daily study milestone (earned XP today, met daily study goal, or active streak).
 */
export function evaluateStreakFlameState(params: {
  currentStreak: number;
  xpToday: number;
  studyMinutesToday: number;
  dailyStudyGoalMinutes: number;
  locale?: LocaleCode;
}): StreakFlameState {
  const streakDays = Math.max(0, Math.floor(params.currentStreak || 0));
  const targetMins = Math.max(5, params.dailyStudyGoalMinutes || 30);
  const dailyGoalReached = params.studyMinutesToday >= targetMins;
  const earnedXpToday = params.xpToday > 0;
  const isMilestoneGlowing = dailyGoalReached || earnedXpToday || streakDays > 0;

  const isUz = params.locale === 'uz';
  const tooltip = isMilestoneGlowing
    ? isUz
      ? `Kunlik marra faol: ${streakDays} kunlik uzluksiz o‘qish · Bugun +${params.xpToday} XP`
      : `Daily study milestone active: ${streakDays}d streak · +${params.xpToday} XP today`
    : isUz
    ? 'Kunlik o‘quv marrasini yoqish uchun darsni yakunlang'
    : 'Complete a lesson today to ignite your daily study milestone flame';

  return {
    isMilestoneGlowing,
    streakDays,
    dailyGoalReached,
    earnedXpToday,
    tooltip,
  };
}

export type TextGlossarySegment =
  | { kind: 'text'; text: string }
  | { kind: 'term'; text: string; termItem: GlossaryTermItem };

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits course lesson paragraph text into plain text and interactive glossary term segments.
 */
export function segmentTextWithGlossaryTerms(
  text: string,
  terms: readonly (KeyTerm | GlossaryTermItem)[]
): TextGlossarySegment[] {
  if (!text) return [];
  const validTerms = terms
    .filter((t) => t && typeof t.term === 'string' && t.term.trim().length >= 3)
    .map((t) => ({
      ...t,
      term: t.term.trim(),
    }))
    .sort((a, b) => b.term.length - a.term.length);

  if (validTerms.length === 0) {
    return [{ kind: 'text', text }];
  }

  const termMap = new Map<string, GlossaryTermItem>();
  const patterns: string[] = [];
  for (const item of validTerms) {
    const lower = item.term.toLowerCase();
    if (!termMap.has(lower)) {
      termMap.set(lower, item);
      patterns.push(escapeRegExp(item.term));
    }
  }

  const regex = new RegExp(`\\b(${patterns.join('|')})\\b`, 'gi');
  const segments: TextGlossarySegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchedText = match[0];
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, start) });
    }
    const found = termMap.get(matchedText.toLowerCase());
    if (found) {
      segments.push({ kind: 'term', text: matchedText, termItem: found });
    } else {
      segments.push({ kind: 'text', text: matchedText });
    }
    lastIndex = start + matchedText.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ kind: 'text', text }];
}

export const LESSON_NOTES_STORAGE_KEY = 'econova_lesson_quick_notes_v1';

export function makeLessonNoteKey(courseId: string, lessonId: string): string {
  return `${courseId.trim()}:${lessonId.trim()}`;
}

export function normalizeLessonNotesMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = k.trim();
    if (cleanKey && typeof v === 'string') {
      out[cleanKey] = v;
    }
  }
  return out;
}

export function mergeLessonNotesMaps(
  localMap: Record<string, string>,
  profileMap: Record<string, string> | undefined
): Record<string, string> {
  return {
    ...normalizeLessonNotesMap(profileMap),
    ...normalizeLessonNotesMap(localMap),
  };
}

export function loadLocalLessonNotes(): Record<string, string> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(LESSON_NOTES_STORAGE_KEY);
    if (!raw) return {};
    return normalizeLessonNotesMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveLocalLessonNotes(notes: Record<string, string>): Record<string, string> {
  const normalized = normalizeLessonNotesMap(notes);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LESSON_NOTES_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota errors
    }
  }
  return normalized;
}

export interface MarkdownPreviewBlock {
  kind: 'h1' | 'h2' | 'h3' | 'bullet' | 'quote' | 'code' | 'paragraph';
  text: string;
}

/**
 * Safe, deterministic Markdown block parser for the Quick Notes slide-out preview.
 */
export function parseSimpleMarkdownBlocks(markdown: string): MarkdownPreviewBlock[] {
  const lines = (markdown || '').split(/\r?\n/);
  const blocks: MarkdownPreviewBlock[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('### ')) {
      blocks.push({ kind: 'h3', text: line.slice(4).trim() });
    } else if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: line.slice(3).trim() });
    } else if (line.startsWith('# ')) {
      blocks.push({ kind: 'h1', text: line.slice(2).trim() });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ kind: 'bullet', text: line.slice(2).trim() });
    } else if (line.startsWith('> ')) {
      blocks.push({ kind: 'quote', text: line.slice(2).trim() });
    } else if (line.startsWith('`') && line.endsWith('`') && line.length > 2) {
      blocks.push({ kind: 'code', text: line.slice(1, -1) });
    } else {
      blocks.push({ kind: 'paragraph', text: line });
    }
  }

  return blocks;
}

/**
 * Resolves the BCP-47 speech recognition locale tag for Web Speech API dictation.
 */
export function resolveSpeechRecognitionLang(locale: LocaleCode): string {
  return locale === 'uz' ? 'uz-UZ' : 'en-US';
}

/**
 * Appends a dictated speech transcript segment cleanly onto existing Markdown note text.
 */
export function appendDictatedTranscriptToMarkdown(
  existingMarkdown: string,
  transcriptChunk: string
): string {
  const cleanChunk = (transcriptChunk || '').trim();
  if (!cleanChunk) return existingMarkdown || '';
  const base = existingMarkdown || '';
  if (!base.trim()) {
    return `- ${cleanChunk}`;
  }
  const needsNewline = !base.endsWith('\n') && !base.endsWith(' ');
  if (base.endsWith('\n')) {
    return `${base}- ${cleanChunk}`;
  }
  return `${base}${needsNewline ? ' ' : ''}${cleanChunk}`;
}

export const QUIZ_WEAKNESS_STORAGE_KEY = 'econova_quiz_weakness_history_v1';

export interface QuizMissedQuestionRecord {
  courseId: string;
  assessmentId: string;
  questionId: string;
  questionSequenceNum: number;
  objectiveRef: string;
  prompt: string;
  missedCount: number;
  lastMissedAt: string;
}

export interface WeaknessLessonRecommendation {
  id: string;
  courseId: string;
  courseTitle: string;
  subject: 'Economics' | 'Mathematics' | 'Business';
  lessonIndex: number;
  lessonTitle: string;
  weakTopicLabel: string;
  missedCount: number;
  severity: 'high' | 'moderate' | 'focus';
  diagnosticReason: string;
  lessonPreviewSummary: string;
  keyConcepts: string[];
}

export interface WeaknessAnalysisSummary {
  totalMissedPatterns: number;
  hasRecordedQuizFailures: boolean;
  recommendations: WeaknessLessonRecommendation[];
}

/**
 * Pure state helper to toggle an expanded recommendation card ID in the Weakness Detection card.
 */
export function toggleExpandedRecommendationId(
  expandedIds: readonly string[],
  recommendationId: string
): string[] {
  if (!recommendationId) return [...expandedIds];
  if (expandedIds.includes(recommendationId)) {
    return expandedIds.filter((id) => id !== recommendationId);
  }
  return [...expandedIds, recommendationId];
}

export function makeLessonTitleFallbackNoteKey(courseId: string, lessonTitle: string): string {
  const normalizedTitle = (lessonTitle || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${courseId.trim()}:title-${normalizedTitle || 'lesson'}`;
}

/**
 * Formats a Weakness Detection recommendation's key concepts and summary as a Markdown block for Quick Notes.
 */
export function formatWeaknessConceptsMarkdownBlock(params: {
  lessonTitle: string;
  weakTopicLabel: string;
  keyConcepts: readonly string[];
  lessonPreviewSummary?: string;
  locale?: LocaleCode;
}): string {
  const isUz = params.locale === 'uz';
  const heading = isUz
    ? `## Asosiy tushunchalar: ${params.lessonTitle} (${params.weakTopicLabel})`
    : `## Key Concepts: ${params.lessonTitle} (${params.weakTopicLabel})`;
  const lines: string[] = [heading];

  const summary = (params.lessonPreviewSummary || '').trim();
  if (summary) {
    lines.push(`> ${summary}`);
  }

  for (const concept of params.keyConcepts) {
    const clean = (concept || '').trim();
    if (clean) {
      lines.push(`- ${clean}`);
    }
  }

  return lines.join('\n');
}

/**
 * Resolves a lesson's saved Markdown note from a notes map, checking both exact courseId:lessonId
 * and fallback courseId:title-<slug> keys saved from the Overview Weakness Detection card.
 */
export function resolveLessonNoteFromMap(
  notesMap: Record<string, string>,
  params: {
    courseId: string;
    lessonId: string;
    lessonTitle?: string;
  }
): string {
  const exactKey = makeLessonNoteKey(params.courseId, params.lessonId);
  const exactVal = (notesMap[exactKey] || '').trim();
  const titleKey = params.lessonTitle
    ? makeLessonTitleFallbackNoteKey(params.courseId, params.lessonTitle)
    : '';
  const titleVal = titleKey && titleKey !== exactKey ? (notesMap[titleKey] || '').trim() : '';

  if (exactVal && titleVal && !exactVal.includes(titleVal)) {
    return `${exactVal}\n\n${titleVal}`;
  }
  return exactVal || titleVal || '';
}

/**
 * Saves a Weakness Detection recommendation's key concepts directly to the user's Quick Notes (localStorage + return map).
 */
export function saveWeaknessConceptsToQuickNotes(params: {
  recommendation: WeaknessLessonRecommendation;
  existingNotes?: Record<string, string>;
  targetLessonId?: string;
  locale?: LocaleCode;
}): {
  updatedNotes: Record<string, string>;
  noteKey: string;
  markdownBlock: string;
} {
  const baseMap = normalizeLessonNotesMap(params.existingNotes ?? loadLocalLessonNotes());
  const markdownBlock = formatWeaknessConceptsMarkdownBlock({
    lessonTitle: params.recommendation.lessonTitle,
    weakTopicLabel: params.recommendation.weakTopicLabel,
    keyConcepts: params.recommendation.keyConcepts,
    lessonPreviewSummary: params.recommendation.lessonPreviewSummary,
    locale: params.locale,
  });

  const titleKey = makeLessonTitleFallbackNoteKey(
    params.recommendation.courseId,
    params.recommendation.lessonTitle
  );
  const primaryKey = params.targetLessonId?.trim()
    ? makeLessonNoteKey(params.recommendation.courseId, params.targetLessonId)
    : titleKey;

  const appendBlockIfMissing = (existingText: string | undefined): string => {
    const current = (existingText || '').trim();
    if (!current) return markdownBlock;
    if (current.includes(markdownBlock)) return current;
    return `${current}\n\n${markdownBlock}`;
  };

  const nextMap: Record<string, string> = {
    ...baseMap,
    [primaryKey]: appendBlockIfMissing(baseMap[primaryKey]),
  };

  if (titleKey !== primaryKey) {
    nextMap[titleKey] = appendBlockIfMissing(baseMap[titleKey]);
  }

  const saved = saveLocalLessonNotes(nextMap);
  return {
    updatedNotes: saved,
    noteKey: primaryKey,
    markdownBlock,
  };
}

/**
 * Generates a concise lesson content preview and key concepts list for a Weakness Detection item.
 */
export function buildWeaknessLessonPreview(params: {
  course: CourseCatalogItem;
  lessonIndex: number;
  lessonTitle: string;
  weakTopicLabel: string;
  missedQuestionPrompt?: string;
  locale: LocaleCode;
}): { lessonPreviewSummary: string; keyConcepts: string[] } {
  const isUz = params.locale === 'uz';
  const ed = params.course.editions[params.locale] ?? params.course.editions.en;

  const baseDescription = ed?.description?.trim() || ed?.subtitle?.trim() || '';
  const missedPromptSnippet = (params.missedQuestionPrompt || '').trim();

  const lessonPreviewSummary = missedPromptSnippet
    ? isUz
      ? `"${params.lessonTitle}" darsi "${params.weakTopicLabel}" mavzusining nazariy va amaliy asoslarini tushuntiradi. Fokus savol: "${missedPromptSnippet}"${baseDescription ? ` — ${baseDescription}` : ''}`
      : `"${params.lessonTitle}" breaks down the core mechanics of ${params.weakTopicLabel}. Focus question: "${missedPromptSnippet}"${baseDescription ? ` — ${baseDescription}` : ''}`
    : baseDescription
    ? isUz
      ? `"${params.lessonTitle}" (${params.weakTopicLabel}): ${baseDescription}`
      : `"${params.lessonTitle}" (${params.weakTopicLabel}): ${baseDescription}`
    : isUz
    ? `Ushbu darsda "${params.weakTopicLabel}" bo‘yicha asosiy formulalar, grafik modellar va yakuniy testda uchraydigan amaliy masalalar ko‘rib chiqiladi.`
    : `Covers foundational models, quantitative intuition, and worked examples for "${params.weakTopicLabel}" tested in the course assessment.`;

  const rawConcepts: string[] = [];
  if (params.weakTopicLabel) {
    rawConcepts.push(params.weakTopicLabel);
  }
  if (ed?.outcomes && Array.isArray(ed.outcomes)) {
    for (const outcome of ed.outcomes) {
      if (outcome && outcome.trim()) {
        rawConcepts.push(outcome.trim());
      }
    }
  }
  if (params.course.topicTags && Array.isArray(params.course.topicTags)) {
    for (const tag of params.course.topicTags) {
      if (tag && tag.trim()) {
        rawConcepts.push(tag.trim());
      }
    }
  }

  // Fallback subject-specific key concepts if outcomes/tags are sparse
  if (rawConcepts.length < 3) {
    const subjectFallbacks =
      params.course.subject === 'Economics'
        ? isUz
          ? ['Talab va taklif muvozanati', 'Chekli tahlil va elastiklik', 'Farovonlik samaradorligi']
          : ['Equilibrium & Price Signals', 'Marginal Analysis & Elasticity', 'Comparative Statics']
        : params.course.subject === 'Mathematics'
        ? isUz
          ? ['Vektor fazolar va matritsalar', 'Optimallashtirish shartlari', 'Qat’iy isbotlash usullari']
          : ['Linear Transformations & Matrices', 'First-Order Optimization', 'Formal Proof Structure']
        : isUz
        ? ['Birlik iqtisodiyoti (LTV / CAC)', 'Pul oqimi va marja tahlili', 'Strategik qarorlar matritsasi']
        : ['Unit Economics (LTV / CAC)', 'Contribution Margin & Cash Flow', 'Strategic Trade-off Modeling'];

    for (const fb of subjectFallbacks) {
      rawConcepts.push(fb);
    }
  }

  const uniqueConcepts: string[] = [];
  const seenLower = new Set<string>();
  for (const item of rawConcepts) {
    const key = item.toLowerCase();
    if (!seenLower.has(key)) {
      seenLower.add(key);
      uniqueConcepts.push(item);
    }
    if (uniqueConcepts.length >= 3) break;
  }

  return {
    lessonPreviewSummary,
    keyConcepts: uniqueConcepts,
  };
}

export function loadQuizWeaknessHistory(): QuizMissedQuestionRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(QUIZ_WEAKNESS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QuizMissedQuestionRecord =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof item.courseId === 'string' &&
            typeof item.questionId === 'string'
        )
    );
  } catch {
    return [];
  }
}

export function recordQuizAttemptWeaknesses(params: {
  courseId: string;
  assessmentId: string;
  missedQuestions: Array<{
    questionId: string;
    questionSequenceNum: number;
    objectiveRef: string;
    prompt: string;
  }>;
  existingHistory?: readonly QuizMissedQuestionRecord[];
  nowIso?: string;
}): QuizMissedQuestionRecord[] {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const base = [...(params.existingHistory ?? loadQuizWeaknessHistory())];
  const byKey = new Map<string, QuizMissedQuestionRecord>();

  for (const item of base) {
    byKey.set(`${item.courseId}:${item.questionId}`, { ...item });
  }

  for (const missed of params.missedQuestions) {
    if (!missed.questionId) continue;
    const key = `${params.courseId}:${missed.questionId}`;
    const prev = byKey.get(key);
    byKey.set(key, {
      courseId: params.courseId,
      assessmentId: params.assessmentId,
      questionId: missed.questionId,
      questionSequenceNum: Math.max(1, missed.questionSequenceNum || 1),
      objectiveRef: missed.objectiveRef || 'Core Concept',
      prompt: missed.prompt || '',
      missedCount: (prev?.missedCount ?? 0) + 1,
      lastMissedAt: nowIso,
    });
  }

  const next = Array.from(byKey.values()).sort((a, b) => {
    if (b.missedCount !== a.missedCount) return b.missedCount - a.missedCount;
    return b.lastMissedAt.localeCompare(a.lastMissedAt);
  });

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(QUIZ_WEAKNESS_STORAGE_KEY, JSON.stringify(next.slice(0, 30)));
    } catch {
      // Ignore storage quota restrictions
    }
  }

  return next;
}

/**
 * Analyzes quiz failure patterns and enrollment assessment gaps to recommend specific lessons for review.
 */
export function analyzeWeaknessDetection(params: {
  courses: readonly CourseCatalogItem[];
  enrollments: readonly EnrollmentRecord[];
  weaknessHistory?: readonly QuizMissedQuestionRecord[];
  locale: LocaleCode;
}): WeaknessAnalysisSummary {
  const isUz = params.locale === 'uz';
  const history = params.weaknessHistory ?? loadQuizWeaknessHistory();
  const courseById = new Map<string, CourseCatalogItem>();
  for (const c of params.courses) {
    courseById.set(c.id, c);
  }

  const recommendations: WeaknessLessonRecommendation[] = [];
  const seenKeys = new Set<string>();

  // 1. Analyze recorded incorrect quiz question patterns
  for (const record of history) {
    const course = courseById.get(record.courseId) ?? params.courses[0];
    if (!course) continue;
    const ed = course.editions[params.locale] ?? course.editions.en;
    const courseTitle = ed?.title || course.slug;
    const lessonTitles = ed?.lessonTitles ?? [];
    const lessonCount = Math.max(1, ed?.lessonCount ?? (lessonTitles.length || 1));
    const mappedLessonIdx = Math.min(
      lessonCount - 1,
      Math.max(0, (record.questionSequenceNum || 1) - 1)
    );
    const lessonTitle =
      lessonTitles[mappedLessonIdx] ||
      (isUz
        ? `${mappedLessonIdx + 1}-dars: Asosiy modellar tahlili`
        : `Lesson ${mappedLessonIdx + 1}: Core Conceptual Foundations`);

    const dedupeKey = `${course.id}:${mappedLessonIdx}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const weakTopicLabel =
      record.objectiveRef && record.objectiveRef.trim().length > 2
        ? record.objectiveRef.trim()
        : course.topicTags?.[0] || course.subject;

    const preview = buildWeaknessLessonPreview({
      course,
      lessonIndex: mappedLessonIdx,
      lessonTitle,
      weakTopicLabel,
      missedQuestionPrompt: record.prompt,
      locale: params.locale,
    });

    recommendations.push({
      id: `weak-quiz-${course.id}-${mappedLessonIdx}`,
      courseId: course.id,
      courseTitle,
      subject: course.subject,
      lessonIndex: mappedLessonIdx,
      lessonTitle,
      weakTopicLabel,
      missedCount: Math.max(1, record.missedCount),
      severity: record.missedCount >= 2 ? 'high' : 'moderate',
      diagnosticReason: isUz
        ? `Test savollarida xatolik aniqlandi (${record.missedCount} marta): "${weakTopicLabel}" bo‘yicha darsni qayta ko‘rib chiqing.`
        : `Missed ${record.missedCount}x in quiz attempts on "${weakTopicLabel}" — review this lesson before retrying.`,
      lessonPreviewSummary: preview.lessonPreviewSummary,
      keyConcepts: preview.keyConcepts,
    });

    if (recommendations.length >= 3) break;
  }

  // 2. Analyze enrollments with unpassed assessments or incomplete required lessons
  if (recommendations.length < 3) {
    for (const enr of params.enrollments) {
      if (enr.passedAssessment) continue;
      const course = courseById.get(enr.courseId);
      if (!course) continue;
      const ed = course.editions[params.locale] ?? course.editions.en;
      const courseTitle = ed?.title || course.slug;
      const lessonTitles = ed?.lessonTitles ?? [];
      const incompleteIdx = Math.max(
        0,
        enr.requiredLessonIds.findIndex((id) => !enr.completedLessonIds.includes(id))
      );
      const targetIdx =
        lessonTitles.length > 0 ? Math.min(lessonTitles.length - 1, incompleteIdx) : 0;
      const dedupeKey = `${course.id}:${targetIdx}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const lessonTitle =
        lessonTitles[targetIdx] ||
        (isUz
          ? `${targetIdx + 1}-dars: Muvozanat va miqdoriy tahlil`
          : `Lesson ${targetIdx + 1}: Quantitative Foundations`);
      const weakTopicLabel =
        course.topicTags?.[0] ||
        ed?.outcomes?.[0]?.slice(0, 42) ||
        course.subject;

      const hasFailedScore =
        typeof enr.bestScorePercent === 'number' && !enr.passedAssessment;

      const preview = buildWeaknessLessonPreview({
        course,
        lessonIndex: targetIdx,
        lessonTitle,
        weakTopicLabel,
        locale: params.locale,
      });

      recommendations.push({
        id: `weak-enr-${course.id}-${targetIdx}`,
        courseId: course.id,
        courseTitle,
        subject: course.subject,
        lessonIndex: targetIdx,
        lessonTitle,
        weakTopicLabel,
        missedCount: hasFailedScore ? 1 : 0,
        severity: hasFailedScore ? 'high' : 'focus',
        diagnosticReason: hasFailedScore
          ? isUz
            ? `Oxirgi baholash natijasi (${enr.bestScorePercent}%) o‘tish chegarasidan past — ushbu mavzuni mustahkamlang.`
            : `Best quiz score (${enr.bestScorePercent}%) is below passing threshold — reinforce "${weakTopicLabel}".`
          : isUz
          ? `Yakuniy testda xatoliklarni oldini olish uchun "${weakTopicLabel}" darsini ko‘rib chiqing.`
          : `High-failure-risk assessment topic "${weakTopicLabel}" — review this lesson before taking the quiz.`,
        lessonPreviewSummary: preview.lessonPreviewSummary,
        keyConcepts: preview.keyConcepts,
      });

      if (recommendations.length >= 3) break;
    }
  }

  // No invented fallback: with no quiz misses or unpassed enrollments the card
  // renders an honest empty state instead of fabricated cohort-wide topics.
  return {
    totalMissedPatterns: history.reduce((acc, item) => acc + item.missedCount, 0),
    hasRecordedQuizFailures: history.length > 0,
    recommendations,
  };
}

