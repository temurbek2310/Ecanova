/**
 * Soft-Gate Level Check (Skill Calibration)
 *
 * A per-subject, 6-question diagnostic that places a learner at one of the
 * repo's existing course levels (`Beginner` | `Intermediate` | `Advanced`) and
 * recommends matching courses. Results are stored per user in localStorage —
 * no server tables or migrations are involved.
 */
import type {
  CourseCatalogItem,
  CourseLevel,
  EnrollmentRecord,
  LocaleCode,
  Subject,
} from '../shared/types';
import enMessages from '../messages/en.json';
import uzMessages from '../messages/uz.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const LEVEL_CHECK_SUBJECTS: readonly Subject[] = ['Economics', 'Mathematics', 'Business'] as const;
export const LEVEL_ORDER: readonly CourseLevel[] = ['Beginner', 'Intermediate', 'Advanced'] as const;

/** Tier 1 = Foundation (Beginner), 2 = Applied (Intermediate), 3 = Advanced. */
export type LevelCheckTier = 1 | 2 | 3;

/** Locales the question bank carries text for (RU is ready ahead of an app locale). */
export type LevelCheckLocale = LocaleCode | 'ru';

export type LocalizedText = Record<'en' | 'uz' | 'ru', string>;

export interface LevelCheckQuestion {
  id: string;
  subject: Subject;
  tier: LevelCheckTier;
  prompt: LocalizedText;
  options: [LocalizedText, LocalizedText, LocalizedText, LocalizedText];
  correctIndex: 0 | 1 | 2 | 3;
}

export interface LevelCheckAnswer {
  tier: LevelCheckTier;
  correct: boolean;
}

export interface TierBreakdownEntry {
  correct: number;
  total: number;
}

export type TierBreakdown = Record<LevelCheckTier, TierBreakdownEntry>;

export interface PlacementResult {
  level: CourseLevel;
  score: number;
  total: number;
  tierBreakdown: TierBreakdown;
}

export interface SubjectLevelCheckRecord {
  status: 'completed' | 'skipped';
  level: CourseLevel | null;
  score: number;
  total: number;
  tierBreakdown: TierBreakdown | null;
  updatedAt: string;
}

export type LevelCheckState = Partial<Record<Subject, SubjectLevelCheckRecord>>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ---------------------------------------------------------------------------
// Question bank (6 per subject: 2 Foundation, 2 Applied, 2 Advanced)
// ---------------------------------------------------------------------------

const opt = (en: string, uz: string, ru: string): LocalizedText => ({ en, uz, ru });

export const LEVEL_CHECK_QUESTIONS: readonly LevelCheckQuestion[] = [
  // ----------------------------- Economics -----------------------------
  {
    id: 'econ-f1',
    subject: 'Economics',
    tier: 1,
    prompt: opt(
      'When the price of a good rises (all else equal), what usually happens to the quantity demanded?',
      'Tovar narxi oshganda (boshqa omillar o‘zgarmasa), talab miqdori odatda qanday o‘zgaradi?',
      'Если цена товара растёт (при прочих равных), что обычно происходит с величиной спроса?'
    ),
    options: [
      opt('It increases', 'Oshadi', 'Увеличивается'),
      opt('It decreases', 'Kamayadi', 'Уменьшается'),
      opt('It stays exactly the same', 'Aynan o‘zgarmaydi', 'Остаётся точно таким же'),
      opt('It always doubles', 'Doimo ikki barobar oshadi', 'Всегда удваивается'),
    ],
    correctIndex: 1,
  },
  {
    id: 'econ-f2',
    subject: 'Economics',
    tier: 1,
    prompt: opt(
      'What does “opportunity cost” mean?',
      '“Muqobil xarajat” nimani anglatadi?',
      'Что означают «альтернативные издержки»?'
    ),
    options: [
      opt(
        'The value of the next best alternative you give up',
        'Voz kechilgan eng yaxshi muqobil variantning qiymati',
        'Ценность лучшей упущенной альтернативы'
      ),
      opt('The money price you pay at checkout', 'Kassada to‘langan pul narxi', 'Денежная цена, уплаченная на кассе'),
      opt('A cost that has already been paid', 'Allaqachon to‘langan xarajat', 'Уже понесённые затраты'),
      opt('The total cost of production', 'Ishlab chiqarishning umumiy xarajati', 'Совокупные издержки производства'),
    ],
    correctIndex: 0,
  },
  {
    id: 'econ-a1',
    subject: 'Economics',
    tier: 2,
    prompt: opt(
      'Demand for a product is price-elastic. If the firm cuts its price, total revenue will…',
      'Mahsulotga talab narx bo‘yicha elastik. Firma narxni tushirsa, umumiy tushum…',
      'Спрос на товар эластичен по цене. Если фирма снизит цену, общая выручка…'
    ),
    options: [
      opt('Fall', 'Kamayadi', 'Снизится'),
      opt('Stay unchanged', 'O‘zgarmaydi', 'Не изменится'),
      opt('Rise', 'Oshadi', 'Вырастет'),
      opt('Shift the demand curve left', 'Talab egri chizig‘ini chapga suradi', 'Сдвинет кривую спроса влево'),
    ],
    correctIndex: 2,
  },
  {
    id: 'econ-a2',
    subject: 'Economics',
    tier: 2,
    prompt: opt(
      'Nominal GDP grew by 8% while inflation was 5%. Real GDP growth is approximately…',
      'Nominal YaIM 8% o‘sdi, inflyatsiya esa 5% bo‘ldi. Real YaIM o‘sishi taxminan…',
      'Номинальный ВВП вырос на 8%, инфляция составила 5%. Реальный рост ВВП примерно…'
    ),
    options: [
      opt('13%', '13%', '13%'),
      opt('8%', '8%', '8%'),
      opt('−3%', '−3%', '−3%'),
      opt('3%', '3%', '3%'),
    ],
    correctIndex: 3,
  },
  {
    id: 'econ-x1',
    subject: 'Economics',
    tier: 3,
    prompt: opt(
      'In the IS–LM model with a fixed money supply, expansionary fiscal policy leads to…',
      'Pul taklifi o‘zgarmas IS–LM modelida kengaytiruvchi fiskal siyosat nimaga olib keladi?',
      'В модели IS–LM при фиксированном предложении денег стимулирующая фискальная политика приводит к…'
    ),
    options: [
      opt(
        'Higher output and higher interest rates',
        'Yuqoriroq ishlab chiqarish va yuqoriroq foiz stavkalari',
        'Росту выпуска и росту процентных ставок'
      ),
      opt(
        'Higher output and lower interest rates',
        'Yuqoriroq ishlab chiqarish va pastroq foiz stavkalari',
        'Росту выпуска и снижению процентных ставок'
      ),
      opt(
        'Lower output and higher interest rates',
        'Pastroq ishlab chiqarish va yuqoriroq foiz stavkalari',
        'Снижению выпуска и росту процентных ставок'
      ),
      opt('No change in output or rates', 'Ishlab chiqarish ham, stavkalar ham o‘zgarmaydi', 'Никаких изменений выпуска и ставок'),
    ],
    correctIndex: 0,
  },
  {
    id: 'econ-x2',
    subject: 'Economics',
    tier: 3,
    prompt: opt(
      'A profit-maximizing monopolist chooses output where…',
      'Foydani maksimallashtiruvchi monopolist ishlab chiqarish hajmini qayerda tanlaydi?',
      'Монополист, максимизирующий прибыль, выбирает объём выпуска там, где…'
    ),
    options: [
      opt('Price equals marginal cost', 'Narx chekli xarajatga teng', 'Цена равна предельным издержкам'),
      opt('Price equals average total cost', 'Narx o‘rtacha umumiy xarajatga teng', 'Цена равна средним общим издержкам'),
      opt('Marginal revenue equals marginal cost', 'Chekli daromad chekli xarajatga teng', 'Предельный доход равен предельным издержкам'),
      opt('Marginal revenue equals zero', 'Chekli daromad nolga teng', 'Предельный доход равен нулю'),
    ],
    correctIndex: 2,
  },

  // ---------------------------- Mathematics ----------------------------
  {
    id: 'math-f1',
    subject: 'Mathematics',
    tier: 1,
    prompt: opt('Solve for x: 3x + 5 = 20', 'x ni toping: 3x + 5 = 20', 'Найдите x: 3x + 5 = 20'),
    options: [opt('3', '3', '3'), opt('5', '5', '5'), opt('15', '15', '15'), opt('25/3', '25/3', '25/3')],
    correctIndex: 1,
  },
  {
    id: 'math-f2',
    subject: 'Mathematics',
    tier: 1,
    prompt: opt('What is 25% of 80?', '80 ning 25% i nechaga teng?', 'Чему равны 25% от 80?'),
    options: [opt('20', '20', '20'), opt('25', '25', '25'), opt('32', '32', '32'), opt('40', '40', '40')],
    correctIndex: 0,
  },
  {
    id: 'math-a1',
    subject: 'Mathematics',
    tier: 2,
    prompt: opt(
      'What is the derivative of f(x) = x³?',
      'f(x) = x³ funksiyaning hosilasi nimaga teng?',
      'Чему равна производная функции f(x) = x³?'
    ),
    options: [opt('x²', 'x²', 'x²'), opt('3x', '3x', '3x'), opt('3x²', '3x²', '3x²'), opt('x⁴/4', 'x⁴/4', 'x⁴/4')],
    correctIndex: 2,
  },
  {
    id: 'math-a2',
    subject: 'Mathematics',
    tier: 2,
    prompt: opt(
      'What are the roots of x² − 5x + 6 = 0?',
      'x² − 5x + 6 = 0 tenglamaning ildizlari qaysilar?',
      'Каковы корни уравнения x² − 5x + 6 = 0?'
    ),
    options: [
      opt('1 and 6', '1 va 6', '1 и 6'),
      opt('−2 and −3', '−2 va −3', '−2 и −3'),
      opt('−1 and 6', '−1 va 6', '−1 и 6'),
      opt('2 and 3', '2 va 3', '2 и 3'),
    ],
    correctIndex: 3,
  },
  {
    id: 'math-x1',
    subject: 'Mathematics',
    tier: 3,
    prompt: opt('Evaluate ∫₀¹ 2x dx', '∫₀¹ 2x dx ni hisoblang', 'Вычислите ∫₀¹ 2x dx'),
    options: [opt('0', '0', '0'), opt('1/2', '1/2', '1/2'), opt('1', '1', '1'), opt('2', '2', '2')],
    correctIndex: 2,
  },
  {
    id: 'math-x2',
    subject: 'Mathematics',
    tier: 3,
    prompt: opt(
      'What is the determinant of the matrix [[2, 1], [4, 3]]?',
      '[[2, 1], [4, 3]] matritsaning determinanti nechaga teng?',
      'Чему равен определитель матрицы [[2, 1], [4, 3]]?'
    ),
    options: [opt('10', '10', '10'), opt('2', '2', '2'), opt('−2', '−2', '−2'), opt('6', '6', '6')],
    correctIndex: 1,
  },

  // ------------------------------ Business -----------------------------
  {
    id: 'biz-f1',
    subject: 'Business',
    tier: 1,
    prompt: opt('Profit is calculated as…', 'Foyda qanday hisoblanadi?', 'Прибыль рассчитывается как…'),
    options: [
      opt('Revenue − Costs', 'Tushum − Xarajatlar', 'Выручка − Затраты'),
      opt('Revenue + Costs', 'Tushum + Xarajatlar', 'Выручка + Затраты'),
      opt('Costs − Revenue', 'Xarajatlar − Tushum', 'Затраты − Выручка'),
      opt('Revenue × Number of employees', 'Tushum × Xodimlar soni', 'Выручка × Число сотрудников'),
    ],
    correctIndex: 0,
  },
  {
    id: 'biz-f2',
    subject: 'Business',
    tier: 1,
    prompt: opt(
      'Which of these is a fixed cost for a small café?',
      'Kichik kafe uchun quyidagilardan qaysi biri doimiy xarajat?',
      'Что из перечисленного является постоянными издержками для небольшого кафе?'
    ),
    options: [
      opt('Coffee beans', 'Qahva donalari', 'Кофейные зёрна'),
      opt('Paper cups', 'Qog‘oz stakanlar', 'Бумажные стаканы'),
      opt('Monthly rent', 'Oylik ijara haqi', 'Ежемесячная аренда'),
      opt('Card fees on each sale', 'Har bir sotuvdagi karta komissiyasi', 'Комиссия за каждую оплату картой'),
    ],
    correctIndex: 2,
  },
  {
    id: 'biz-a1',
    subject: 'Business',
    tier: 2,
    prompt: opt(
      'Price is $50, variable cost is $30 per unit and fixed costs are $10,000 per month. How many units break even?',
      'Narx $50, birlik uchun o‘zgaruvchan xarajat $30, oylik doimiy xarajatlar $10 000. Zararsizlik nuqtasi necha birlik?',
      'Цена $50, переменные издержки $30 за единицу, постоянные издержки $10 000 в месяц. Сколько единиц нужно для безубыточности?'
    ),
    options: [opt('200', '200', '200'), opt('500', '500', '500'), opt('333', '333', '333'), opt('1,000', '1 000', '1 000')],
    correctIndex: 1,
  },
  {
    id: 'biz-a2',
    subject: 'Business',
    tier: 2,
    prompt: opt(
      'CAC is $40. A customer brings $15 gross margin per month and stays 6 months. What is the LTV:CAC ratio?',
      'CAC $40. Mijoz oyiga $15 yalpi marja keltiradi va 6 oy qoladi. LTV:CAC nisbati qancha?',
      'CAC = $40. Клиент приносит $15 валовой маржи в месяц и остаётся 6 месяцев. Каково соотношение LTV:CAC?'
    ),
    options: [opt('0.375', '0,375', '0,375'), opt('1.5', '1,5', '1,5'), opt('6', '6', '6'), opt('2.25', '2,25', '2,25')],
    correctIndex: 3,
  },
  {
    id: 'biz-x1',
    subject: 'Business',
    tier: 3,
    prompt: opt(
      'A project costs $1,000 today and returns $1,100 in one year. At a 12% discount rate, its NPV is…',
      'Loyiha bugun $1 000 turadi va bir yildan so‘ng $1 100 qaytaradi. 12% diskont stavkasida NPV…',
      'Проект стоит $1 000 сегодня и приносит $1 100 через год. При ставке дисконтирования 12% его NPV…'
    ),
    options: [
      opt('About +$100', 'Taxminan +$100', 'Около +$100'),
      opt('About +$18', 'Taxminan +$18', 'Около +$18'),
      opt('About −$18', 'Taxminan −$18', 'Около −$18'),
      opt('Exactly $0', 'Aynan $0', 'Ровно $0'),
    ],
    correctIndex: 2,
  },
  {
    id: 'biz-x2',
    subject: 'Business',
    tier: 3,
    prompt: opt(
      'Current assets are $300k, current liabilities $200k and inventory $120k. What is the quick ratio?',
      'Joriy aktivlar $300k, joriy majburiyatlar $200k, tovar-moddiy zaxiralar $120k. Tezkor likvidlik koeffitsienti qancha?',
      'Оборотные активы $300k, краткосрочные обязательства $200k, запасы $120k. Каков коэффициент быстрой ликвидности?'
    ),
    options: [opt('1.5', '1,5', '1,5'), opt('0.9', '0,9', '0,9'), opt('0.6', '0,6', '0,6'), opt('2.5', '2,5', '2,5')],
    correctIndex: 1,
  },
];

export function getLevelCheckQuestions(subject: Subject): LevelCheckQuestion[] {
  return LEVEL_CHECK_QUESTIONS.filter((q) => q.subject === subject).sort((a, b) => a.tier - b.tier);
}

export function localizeText(text: LocalizedText, locale: LevelCheckLocale | string): string {
  const key = locale === 'uz' || locale === 'ru' ? locale : 'en';
  return text[key] || text.en;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function emptyBreakdown(): TierBreakdown {
  return { 1: { correct: 0, total: 0 }, 2: { correct: 0, total: 0 }, 3: { correct: 0, total: 0 } };
}

/**
 * Tier-weighted placement:
 * - 0–2 correct, or no Foundation question answered correctly → Beginner
 * - 5–6 correct with at least one Advanced correct            → Advanced
 * - everything else (3–4 correct)                              → Intermediate
 */
export function calculatePlacementLevel(answers: readonly LevelCheckAnswer[]): PlacementResult {
  const tierBreakdown = emptyBreakdown();
  for (const answer of answers) {
    const bucket = tierBreakdown[answer.tier];
    bucket.total += 1;
    if (answer.correct) bucket.correct += 1;
  }
  const score = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const failedFoundation = tierBreakdown[1].total > 0 && tierBreakdown[1].correct === 0;

  let level: CourseLevel;
  if (score <= 2 || failedFoundation) {
    level = 'Beginner';
  } else if (score >= 5 && tierBreakdown[3].correct >= 1) {
    level = 'Advanced';
  } else {
    level = 'Intermediate';
  }
  return { level, score, total, tierBreakdown };
}

/** Grades raw option selections (questionId → chosen option index) for a subject. */
export function gradeLevelCheckSelections(
  subject: Subject,
  selections: Readonly<Record<string, number | undefined>>
): LevelCheckAnswer[] {
  return getLevelCheckQuestions(subject).map((q) => ({
    tier: q.tier,
    correct: selections[q.id] === q.correctIndex,
  }));
}

// ---------------------------------------------------------------------------
// Persistence (localStorage, per user)
// ---------------------------------------------------------------------------

export function levelCheckStorageKey(userId: string): string {
  return `econova:level-check:v1:${userId}`;
}

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // Access to localStorage can throw in privacy mode.
  }
  return null;
}

function isSubject(value: unknown): value is Subject {
  return typeof value === 'string' && (LEVEL_CHECK_SUBJECTS as readonly string[]).includes(value);
}

function isLevel(value: unknown): value is CourseLevel {
  return typeof value === 'string' && (LEVEL_ORDER as readonly string[]).includes(value);
}

export function getLevelCheckState(userId: string | null | undefined, storage?: StorageLike | null): LevelCheckState {
  if (!userId) return {};
  const store = resolveStorage(storage);
  if (!store) return {};
  try {
    const raw = store.getItem(levelCheckStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const state: LevelCheckState = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isSubject(key) || !value || typeof value !== 'object') continue;
      const rec = value as Partial<SubjectLevelCheckRecord>;
      if (rec.status !== 'completed' && rec.status !== 'skipped') continue;
      state[key] = {
        status: rec.status,
        level: isLevel(rec.level) ? rec.level : null,
        score: typeof rec.score === 'number' ? rec.score : 0,
        total: typeof rec.total === 'number' ? rec.total : 0,
        tierBreakdown: rec.tierBreakdown ?? null,
        updatedAt: typeof rec.updatedAt === 'string' ? rec.updatedAt : new Date(0).toISOString(),
      };
    }
    return state;
  } catch {
    return {};
  }
}

function writeLevelCheckState(userId: string, state: LevelCheckState, storage?: StorageLike | null): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(levelCheckStorageKey(userId), JSON.stringify(state));
  } catch {
    // Ignore quota / privacy-mode errors.
  }
}

export function shouldPromptLevelCheck(
  userId: string | null | undefined,
  subject: Subject,
  hasSubjectEnrollment: boolean,
  storage?: StorageLike | null
): boolean {
  if (!userId || hasSubjectEnrollment) return false;
  return !getLevelCheckState(userId, storage)[subject];
}

export function saveLevelCheckResult(
  userId: string,
  subject: Subject,
  result: PlacementResult,
  storage?: StorageLike | null,
  now: Date = new Date()
): LevelCheckState {
  const next: LevelCheckState = {
    ...getLevelCheckState(userId, storage),
    [subject]: {
      status: 'completed',
      level: result.level,
      score: result.score,
      total: result.total,
      tierBreakdown: result.tierBreakdown,
      updatedAt: now.toISOString(),
    },
  };
  writeLevelCheckState(userId, next, storage);
  return next;
}

export function markLevelCheckSkipped(
  userId: string,
  subject: Subject,
  storage?: StorageLike | null,
  now: Date = new Date()
): LevelCheckState {
  const current = getLevelCheckState(userId, storage);
  // Skipping never overwrites an existing completed placement.
  if (current[subject]?.status === 'completed') return current;
  const next: LevelCheckState = {
    ...current,
    [subject]: { status: 'skipped', level: null, score: 0, total: 0, tierBreakdown: null, updatedAt: now.toISOString() },
  };
  writeLevelCheckState(userId, next, storage);
  return next;
}

export function resetSubjectLevelCheck(
  userId: string,
  subject: Subject,
  storage?: StorageLike | null
): LevelCheckState {
  const next = { ...getLevelCheckState(userId, storage) };
  delete next[subject];
  writeLevelCheckState(userId, next, storage);
  return next;
}

/** Placed level for a subject, only when the check was actually completed. */
export function getPlacedLevel(state: LevelCheckState, subject: Subject): CourseLevel | null {
  const rec = state[subject];
  return rec?.status === 'completed' ? rec.level : null;
}

export function hasSubjectEnrollment(
  courses: readonly CourseCatalogItem[],
  enrollments: readonly EnrollmentRecord[],
  subject: Subject
): boolean {
  if (enrollments.length === 0) return false;
  const subjectCourseIds = new Set(courses.filter((c) => c.subject === subject).map((c) => c.id));
  return enrollments.some((e) => subjectCourseIds.has(e.courseId));
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

/**
 * Courses in `subject` at `placedLevel`. When none exist at that level, falls
 * back to the closest level (ties prefer the easier level).
 */
export function getRecommendedCourses(
  courses: readonly CourseCatalogItem[],
  subject: Subject,
  placedLevel: CourseLevel
): CourseCatalogItem[] {
  const inSubject = courses.filter((c) => c.subject === subject);
  if (inSubject.length === 0) return [];
  const target = LEVEL_ORDER.indexOf(placedLevel);
  const distance = (level: CourseLevel) => Math.abs(LEVEL_ORDER.indexOf(level) - target);
  const best = Math.min(...inSubject.map((c) => distance(c.level)));
  const candidates = inSubject.filter((c) => distance(c.level) === best);
  // Prefer the easier level on ties (e.g. Intermediate missing → Beginner before Advanced).
  const easiest = Math.min(...candidates.map((c) => LEVEL_ORDER.indexOf(c.level)));
  return candidates.filter((c) => LEVEL_ORDER.indexOf(c.level) === easiest);
}

// ---------------------------------------------------------------------------
// UI copy (EN/UZ live in the i18n dictionary; RU is kept here like the tour copy)
// ---------------------------------------------------------------------------

export type LevelCheckCopy = typeof enMessages.levelCheck;

export const LEVEL_CHECK_COPY_RU: LevelCheckCopy = {
  telemetryIntro: 'КАЛИБРОВКА // {subject}',
  telemetryRunner: 'КАЛИБРОВКА // {subject} // {current} ИЗ {total}',
  telemetryResult: 'КАЛИБРОВКА // {subject} // РЕЗУЛЬТАТ',
  introTitle: 'Найдём вашу стартовую точку',
  introBody: 'Короткая проверка из 6 вопросов подскажет, с какого уровня курсов по предмету «{subject}» лучше начать.',
  introHigherLevel: '«{course}» — курс уровня «{level}». 2-минутная проверка поможет понять, подходит ли он вам для старта.',
  startCheck: 'Проверить уровень (2 мин · 6 вопросов)',
  skipToCourse: 'Начинаю с нуля / Перейти к курсу',
  skipNoCourse: 'Не сейчас',
  tierFoundation: 'Основы',
  tierApplied: 'Применение',
  tierAdvanced: 'Продвинутый',
  keyboardHint: '1–4 — выбрать · Enter — далее · Esc — закрыть',
  next: 'Далее',
  finish: 'Показать результат',
  resultTitle: 'Ваш уровень',
  scoreLabel: 'Результат',
  recommendedHeading: 'Рекомендуемые курсы',
  fallbackNote: 'Курсов этого уровня пока нет — показываем ближайший уровень.',
  noCourses: 'В этом предмете пока нет опубликованных курсов.',
  startRecommended: 'Начать рекомендуемый курс',
  openOriginal: 'Всё равно открыть выбранный курс',
  close: 'Закрыть',
  recommendedBadge: 'Рекомендовано вам',
  profileTitle: 'Калибровка навыков',
  profileSubtitle: 'Двухминутная проверка по каждому предмету подбирает подходящий уровень курсов. Её можно пройти заново в любой момент.',
  notChecked: 'Ещё не проверено',
  skipped: 'Пропущено',
  takeCheck: 'Пройти проверку',
  retakeCheck: 'Пройти заново',
};

export function getLevelCheckCopy(locale: LevelCheckLocale | string): LevelCheckCopy {
  const normalized = (locale || '').toLowerCase().trim();
  if (normalized === 'ru') return LEVEL_CHECK_COPY_RU;
  if (normalized === 'uz') return (uzMessages as { levelCheck: LevelCheckCopy }).levelCheck;
  return enMessages.levelCheck;
}

export function tierLabel(copy: LevelCheckCopy, tier: LevelCheckTier): string {
  return tier === 1 ? copy.tierFoundation : tier === 2 ? copy.tierApplied : copy.tierAdvanced;
}
