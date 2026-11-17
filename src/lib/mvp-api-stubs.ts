import type {
  AssessmentPublic,
  BadgeAward,
  CertificateRecord,
  CourseCatalogItem,
  CourseDetailResponse,
  CourseEditionSummary,
  EnrollmentRecord,
  LeaderboardEntry,
  LessonBlock,
  LessonPublic,
  LocaleCode,
  QuizLeaderboardEntry,
  StreakSummary,
  UserSummary,
  XpLedgerEntry,
} from '../shared/types';
import {
  filterQuizLeaderboardEntriesByCourse,
  getCurrentWeekWindow,
  type WeekWindow,
} from './quiz-leaderboard';

export interface MvpGuestAuthResponse {
  id: string;
  name: string;
  role: 'student' | UserSummary['role'];
  email: string;
  displayName: string;
  user: UserSummary & { name: string };
  sessionToken: string;
}

export const MVP_GUEST_USER: UserSummary & { name: string } = {
  id: '1',
  name: 'Guest User',
  displayName: 'Guest User',
  email: 'guest@econova.edu.uz',
  role: 'learner',
  preferredLocale: 'en',
  timezone: 'Asia/Tashkent',
  ageBand: 'university',
  leaderboardOptIn: true,
  leaderboardPseudonym: 'tashkent_quant_99',
  consentAcceptedAt: '2026-03-01T00:00:00.000Z',
  dailyStudyGoalMinutes: 20,
  studyGoalNotificationsEnabled: false,
  weeklyDigestEmailEnabled: false,
  lessonNotes: {},
  bookmarkedCourseIds: ['course-macro-stabilization', 'course-quant-calculus'],
};

function createEditionSummary(params: {
  id: string;
  courseId: string;
  locale: LocaleCode;
  title: string;
  subtitle: string;
  description: string;
  lessonCount: number;
  lessonTitles: string[];
  estimatedMinutes: number;
}): CourseEditionSummary {
  return {
    id: params.id,
    courseId: params.courseId,
    locale: params.locale,
    version: 1,
    title: params.title,
    subtitle: params.subtitle,
    description: params.description,
    outcomes: params.lessonTitles,
    prerequisites: [],
    completionRules: 'Complete all required lessons and score at least 75% on the final assessment.',
    passingScorePercent: 75,
    status: 'published',
    subjectReviewerId: 'user-reviewer',
    languageReviewerId: 'user-reviewer',
    rightsReviewerId: 'user-reviewer',
    publishedAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    lessonCount: params.lessonCount,
    lessonTitles: params.lessonTitles,
    estimatedMinutes: params.estimatedMinutes,
    provenance: null,
  };
}

export const MVP_CATALOG_COURSES: CourseCatalogItem[] = [
  {
    id: 'course-macro-stabilization',
    slug: 'macroeconomic-stabilization-monetary-policy',
    subject: 'Economics',
    level: 'Intermediate',
    estimatedMinutes: 55,
    topicTags: ['Monetary Policy', 'Inflation', 'Open Economy'],
    editions: {
      en: createEditionSummary({
        id: 'ed-macro-en-v1',
        courseId: 'course-macro-stabilization',
        locale: 'en',
        title: 'Macroeconomic Stabilization & Monetary Policy',
        subtitle: 'Analyze inflation targeting, central bank reaction functions, and open-economy shocks.',
        description:
          'Rigorous quantitative study of Taylor rules, sovereign yield curves, and fiscal-monetary coordination in emerging markets.',
        lessonCount: 4,
        lessonTitles: [
          'Aggregate Demand & Supply Equilibrium',
          'Taylor Rule & Central Bank Reaction Functions',
          'Open-Economy Exchange Rate Pass-Through',
          'Sovereign Yield Curves & Fiscal Anchor',
        ],
        estimatedMinutes: 55,
      }),
      uz: createEditionSummary({
        id: 'ed-macro-uz-v1',
        courseId: 'course-macro-stabilization',
        locale: 'uz',
        title: 'Makroiqtisodiy barqarorlashtirish va pul-kredit siyosati',
        subtitle:
          'Inflyatsiyani targetlash, Markaziy bank reaksiya funksiyalari va tashqi shoklarni tahlil qiling.',
        description:
          'Rivojlanayotgan bozorlarda Teylor qoidalari, suveren daromadlilik egri chiziqlari va fiskal-monetar muvofiqlashtirishning miqdoriy tahlili.',
        lessonCount: 4,
        lessonTitles: [
          'Yalpi talab va yalpi taklif muvozanati',
          'Teylor qoidasi va Markaziy bank reaksiyasi',
          'Ochiq iqtisodiyot va valyuta kursi transmissiyasi',
          'Suveren daromadlilik egri chizig‘i va fiskal langar',
        ],
        estimatedMinutes: 55,
      }),
    },
  },
  {
    id: 'course-quant-calculus',
    slug: 'multivariable-calculus-constrained-optimization',
    subject: 'Mathematics',
    level: 'Advanced',
    estimatedMinutes: 65,
    topicTags: ['Calculus', 'Optimization', 'Lagrangian'],
    editions: {
      en: createEditionSummary({
        id: 'ed-calc-en-v1',
        courseId: 'course-quant-calculus',
        locale: 'en',
        title: 'Multivariable Calculus & Constrained Optimization',
        subtitle: 'Master gradients, Hessian matrices, and Lagrangian multipliers for economic modeling.',
        description:
          'First-principles derivation of shadow prices, Karush-Kuhn-Tucker conditions, and convexity proofs for quantitative analysts.',
        lessonCount: 4,
        lessonTitles: [
          'Partial Derivatives & Directional Gradients',
          'Hessian Matrices & Second-Order Convexity',
          'Lagrangian Multipliers & Shadow Prices',
          'Envelope Theorem & Comparative Statics',
        ],
        estimatedMinutes: 65,
      }),
      uz: createEditionSummary({
        id: 'ed-calc-uz-v1',
        courseId: 'course-quant-calculus',
        locale: 'uz',
        title: 'Ko‘p o‘zgaruvchili analiz va shartli optimallashtirish',
        subtitle:
          'Gradiyentlar, Gessian matritsalari va Lagranj ko‘paytuvchilarini amaliy modellashtirishda qo‘llang.',
        description:
          'Miqdoriy tahlilchilar uchun soya narxlari, Karush-Kun-Takker shartlari va qavariqlik isbotlarining fundamental asoslari.',
        lessonCount: 4,
        lessonTitles: [
          'Xususiy hosilalar va gradiyent vektorlari',
          'Gessian matritsasi va ikkinchi tartibli qavariqlik',
          'Lagranj ko‘paytuvchilari va soya narxlari',
          'Konvert teoremasi va qiyosiy statika',
        ],
        estimatedMinutes: 65,
      }),
    },
  },
  {
    id: 'course-venture-unit-economics',
    slug: 'venture-economics-capital-allocation',
    subject: 'Business',
    level: 'Beginner',
    estimatedMinutes: 45,
    topicTags: ['Unit Economics', 'Capital Allocation', 'Cohorts'],
    editions: {
      en: createEditionSummary({
        id: 'ed-biz-en-v1',
        courseId: 'course-venture-unit-economics',
        locale: 'en',
        title: 'Venture Unit Economics & Capital Allocation',
        subtitle: 'Evaluate LTV/CAC cohorts, contribution margins, and discounted cash flows.',
        description:
          'Build institutional-grade unit economics models, retention cohorts, and WACC sensitivity matrices for high-growth enterprises.',
        lessonCount: 3,
        lessonTitles: [
          'Contribution Margin & Payback Period Mechanics',
          'Cohort Retention & Net Dollar Expansion',
          'Capital Allocation & WACC Hurdle Rates',
        ],
        estimatedMinutes: 45,
      }),
      uz: createEditionSummary({
        id: 'ed-biz-uz-v1',
        courseId: 'course-venture-unit-economics',
        locale: 'uz',
        title: 'Venchur unit-iqtisodiyoti va kapital taqsimoti',
        subtitle: 'LTV/CAC kohortalari, marjinal daromad va diskontlangan pul oqimlarini baholang.',
        description:
          'Yuqori o‘sish sur’atiga ega korxonalar uchun unit-iqtisodiyot modellari, ushlab qolish kohortalari va WACC sezgirlik matritsalarini tuzish.',
        lessonCount: 3,
        lessonTitles: [
          'Marjinal daromad va o‘zini oqlash davri',
          'Kohorta ushlab qolish va sof daromad o‘sishi',
          'Kapital taqsimoti va WACC stavkalari',
        ],
        estimatedMinutes: 45,
      }),
    },
  },
  {
    id: 'course-applied-econometrics',
    slug: 'applied-econometrics-causal-inference',
    subject: 'Economics',
    level: 'Advanced',
    estimatedMinutes: 60,
    topicTags: ['Econometrics', 'Causal Inference', 'OLS'],
    editions: {
      en: createEditionSummary({
        id: 'ed-metrics-en-v1',
        courseId: 'course-applied-econometrics',
        locale: 'en',
        title: 'Applied Econometrics & Causal Inference',
        subtitle: 'Identify causal effects using instrumental variables, DID, and regression discontinuity.',
        description:
          'Hands-on empirical methods covering OLS Gauss-Markov assumptions, heteroskedasticity-robust inference, and panel estimators.',
        lessonCount: 3,
        lessonTitles: [
          'OLS Gauss-Markov Assumptions & Omitted Variable Bias',
          'Instrumental Variables & Two-Stage Least Squares',
          'Difference-in-Differences & Panel Fixed Effects',
        ],
        estimatedMinutes: 60,
      }),
      uz: createEditionSummary({
        id: 'ed-metrics-uz-v1',
        courseId: 'course-applied-econometrics',
        locale: 'uz',
        title: 'Amaliy ekonometrika va sabab-oqibat tahlili',
        subtitle:
          'Instrumental o‘zgaruvchilar, DID va regressiya uzilishi orqali sababiy ta’sirlarni aniqlang.',
        description:
          'Eng kichik kvadratlar usuli, geteroskedastiklikka chidamli baholash va panel ma’lumotlar modellari bo‘yicha amaliy metodlar.',
        lessonCount: 3,
        lessonTitles: [
          'EKKU Gauss-Markov shartlari va tushirib qoldirilgan o‘zgaruvchi',
          'Instrumental o‘zgaruvchilar va ikki bosqichli EKKU',
          'Farqlar ichidagi farq (DID) va panel modellari',
        ],
        estimatedMinutes: 60,
      }),
    },
  },
  {
    id: 'course-linear-algebra-markets',
    slug: 'linear-algebra-portfolio-eigenvalues',
    subject: 'Mathematics',
    level: 'Intermediate',
    estimatedMinutes: 50,
    topicTags: ['Linear Algebra', 'Eigenvalues', 'Portfolio Theory'],
    editions: {
      en: createEditionSummary({
        id: 'ed-linalg-en-v1',
        courseId: 'course-linear-algebra-markets',
        locale: 'en',
        title: 'Linear Algebra & Spectral Portfolio Theory',
        subtitle: 'Decompose covariance matrices using eigenvalues, SVD, and orthogonal projections.',
        description:
          'Matrix algebra for factor models, Markov transition chains, and principal component decomposition of financial risk.',
        lessonCount: 3,
        lessonTitles: [
          'Vector Spaces, Basis & Orthogonal Projections',
          'Eigenvalues, Spectral Theorem & Risk Factors',
          'Markov Chains & Stationary Distributions',
        ],
        estimatedMinutes: 50,
      }),
      uz: createEditionSummary({
        id: 'ed-linalg-uz-v1',
        courseId: 'course-linear-algebra-markets',
        locale: 'uz',
        title: 'Chiziqli algebra va spektral portfel nazariyasi',
        subtitle: 'Xos qiymatlar, SVD va ortogonal proyeksiyalar yordamida kovariatsiya matritsalarini yoyish.',
        description:
          'Omilli modellar, Markov o‘tish zanjirlari va moliyaviy xavfning asosiy komponentlar tahlili uchun matritsalar algebrasi.',
        lessonCount: 3,
        lessonTitles: [
          'Vektor fazolar, bazis va ortogonal proyeksiya',
          'Xos qiymatlar, spektral teorema va xavf omillari',
          'Markov zanjirlari va statsionar taqsimotlar',
        ],
        estimatedMinutes: 50,
      }),
    },
  },
  {
    id: 'course-corporate-valuation',
    slug: 'strategic-corporate-finance-valuation',
    subject: 'Business',
    level: 'Intermediate',
    estimatedMinutes: 50,
    topicTags: ['Corporate Finance', 'DCF', 'Valuation'],
    editions: {
      en: createEditionSummary({
        id: 'ed-val-en-v1',
        courseId: 'course-corporate-valuation',
        locale: 'en',
        title: 'Strategic Corporate Finance & DCF Valuation',
        subtitle: 'Model free cash flow to firm, terminal value multiples, and capital structure trade-offs.',
        description:
          'Quantitative corporate valuation bridging accounting statements, ROIC spread analysis, and scenario-weighted enterprise value.',
        lessonCount: 3,
        lessonTitles: [
          'Free Cash Flow to Firm (FCFF) & Working Capital',
          'ROIC vs. WACC Spread & Value Creation',
          'Terminal Value Multiples & Scenario Sensitivity',
        ],
        estimatedMinutes: 50,
      }),
      uz: createEditionSummary({
        id: 'ed-val-uz-v1',
        courseId: 'course-corporate-valuation',
        locale: 'uz',
        title: 'Strategik korporativ moliya va DCF baholash',
        subtitle:
          'Erkin pul oqimlari, terminal qiymat multiplikatorlari va kapital tarkibini modellashtiring.',
        description:
          'Moliyaviy hisobotlar, ROIC spred tahlili va ssenariylarga asoslangan korxona qiymatini birlashtiruvchi miqdoriy baholash.',
        lessonCount: 3,
        lessonTitles: [
          'Korxona erkin pul oqimi (FCFF) va aylanma kapital',
          'ROIC va WACC spredi hamda qiymat yaratish',
          'Terminal qiymat va ssenariy sezgirlik tahlili',
        ],
        estimatedMinutes: 50,
      }),
    },
  },
];

export const MVP_QUIZ_LEADERBOARD: QuizLeaderboardEntry[] = [
  {
    rank: 1,
    pseudonym: 'samarkand_euler_01',
    courseId: 'course-quant-calculus',
    courseTitle: 'Multivariable Calculus & Constrained Optimization',
    subject: 'Mathematics',
    assessmentId: 'asmt-calc-en-1',
    assessmentTitle: 'Hessian & Lagrangian Mastery Exam',
    bestScorePercent: 98.4,
    attemptsCountThisWeek: 1,
    passed: true,
    achievedAt: '2026-03-26T08:15:00.000Z',
    isCurrentUser: false,
  },
  {
    rank: 2,
    pseudonym: 'tashkent_quant_99',
    courseId: 'course-macro-stabilization',
    courseTitle: 'Macroeconomic Stabilization & Monetary Policy',
    subject: 'Economics',
    assessmentId: 'asmt-macro-en-1',
    assessmentTitle: 'Monetary Policy & Taylor Rule Assessment',
    bestScorePercent: 95.5,
    attemptsCountThisWeek: 1,
    passed: true,
    achievedAt: '2026-03-26T11:42:00.000Z',
    isCurrentUser: true,
  },
  {
    rank: 3,
    pseudonym: 'fergana_gauss_17',
    courseId: 'course-applied-econometrics',
    courseTitle: 'Applied Econometrics & Causal Inference',
    subject: 'Economics',
    assessmentId: 'asmt-metrics-en-1',
    assessmentTitle: 'Instrumental Variables & DID Exam',
    bestScorePercent: 93.0,
    attemptsCountThisWeek: 2,
    passed: true,
    achievedAt: '2026-03-25T16:08:00.000Z',
    isCurrentUser: false,
  },
  {
    rank: 4,
    pseudonym: 'bukhara_simplex_08',
    courseId: 'course-venture-unit-economics',
    courseTitle: 'Venture Unit Economics & Capital Allocation',
    subject: 'Business',
    assessmentId: 'asmt-biz-en-1',
    assessmentTitle: 'Cohort LTV/CAC & Payback Audit',
    bestScorePercent: 91.2,
    attemptsCountThisWeek: 1,
    passed: true,
    achievedAt: '2026-03-25T19:30:00.000Z',
    isCurrentUser: false,
  },
  {
    rank: 5,
    pseudonym: 'khiva_spectral_24',
    courseId: 'course-linear-algebra-markets',
    courseTitle: 'Linear Algebra & Spectral Portfolio Theory',
    subject: 'Mathematics',
    assessmentId: 'asmt-linalg-en-1',
    assessmentTitle: 'Eigenvalue Risk Decomposition Exam',
    bestScorePercent: 89.6,
    attemptsCountThisWeek: 2,
    passed: true,
    achievedAt: '2026-03-24T14:20:00.000Z',
    isCurrentUser: false,
  },
  {
    rank: 6,
    pseudonym: 'namangan_dcf_12',
    courseId: 'course-corporate-valuation',
    courseTitle: 'Strategic Corporate Finance & DCF Valuation',
    subject: 'Business',
    assessmentId: 'asmt-val-en-1',
    assessmentTitle: 'WACC & Terminal Value Sensitivity Exam',
    bestScorePercent: 87.5,
    attemptsCountThisWeek: 2,
    passed: true,
    achievedAt: '2026-03-24T09:50:00.000Z',
    isCurrentUser: false,
  },
];

export const MVP_COHORT_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    pseudonym: 'samarkand_euler_01',
    cohortXp: 920,
    lessonsCompleted: 14,
    isCurrentUser: false,
  },
  {
    rank: 2,
    pseudonym: 'tashkent_quant_99',
    cohortXp: 845,
    lessonsCompleted: 12,
    isCurrentUser: true,
  },
  {
    rank: 3,
    pseudonym: 'fergana_gauss_17',
    cohortXp: 790,
    lessonsCompleted: 11,
    isCurrentUser: false,
  },
  {
    rank: 4,
    pseudonym: 'bukhara_simplex_08',
    cohortXp: 715,
    lessonsCompleted: 9,
    isCurrentUser: false,
  },
  {
    rank: 5,
    pseudonym: 'khiva_spectral_24',
    cohortXp: 660,
    lessonsCompleted: 8,
    isCurrentUser: false,
  },
];

export function buildHealthPayload(now: Date = new Date()) {
  return {
    status: 'ok' as const,
    ok: true,
    timestamp: now.toISOString(),
    service: 'econova',
    database: 'supabase_postgresql',
    databaseConfigured: true,
    sessionConfigured: true,
    googleOAuthConfigured: false,
    aiConfigured: true,
    sandboxEnabled: true,
  };
}

export function buildAuthMePayload(userOverride?: UserSummary | null): MvpGuestAuthResponse {
  const resolvedUser: UserSummary & { name: string } = userOverride
    ? {
        ...userOverride,
        name: userOverride.displayName || 'Guest User',
      }
    : MVP_GUEST_USER;

  return {
    id: resolvedUser.id,
    name: resolvedUser.name,
    role: userOverride ? resolvedUser.role : 'student',
    email: resolvedUser.email,
    displayName: resolvedUser.displayName,
    user: resolvedUser,
    sessionToken: 'econova-mvp-guest-session',
  };
}

export function buildCatalogPayload() {
  return {
    courses: MVP_CATALOG_COURSES,
    items: MVP_CATALOG_COURSES,
  };
}

export function buildLeaderboardsPayload(
  courseIdFilter: string = 'all',
  now: Date = new Date()
): {
  cohortName: string;
  entries: LeaderboardEntry[];
  quizLeaderboard: QuizLeaderboardEntry[];
  weekWindow: WeekWindow;
} {
  const weekWindow = getCurrentWeekWindow(now);
  const quizLeaderboard = filterQuizLeaderboardEntriesByCourse(
    MVP_QUIZ_LEADERBOARD,
    courseIdFilter
  );

  return {
    cohortName: 'Tashkent Quantitative Spring Cohort',
    entries: MVP_COHORT_LEADERBOARD,
    quizLeaderboard,
    weekWindow,
  };
}

export function buildGuestOverviewPayload(): {
  enrollments: EnrollmentRecord[];
  totalXp: number;
  xpToday: number;
  studyMinutesToday: number;
  dailyStudyGoalMinutes: number;
  xpLedger: XpLedgerEntry[];
  streak: StreakSummary;
  badges: BadgeAward[];
} {
  const nowIso = new Date().toISOString();
  return {
    enrollments: [
      {
        id: 'enr-macro-1',
        courseId: 'course-macro-stabilization',
        locale: 'en',
        journeyStatus: 'completed',
        completedLessonIds: ['l-macro-1', 'l-macro-2', 'l-macro-3', 'l-macro-4'],
        requiredLessonIds: ['l-macro-1', 'l-macro-2', 'l-macro-3', 'l-macro-4'],
        bestScorePercent: 95.5,
        passedAssessment: true,
        enrolledAt: '2026-03-10T09:00:00.000Z',
        completedAt: '2026-03-26T11:45:00.000Z',
        pausedAt: null,
      },
      {
        id: 'enr-calc-1',
        courseId: 'course-quant-calculus',
        locale: 'en',
        journeyStatus: 'progressing',
        completedLessonIds: ['l-calc-1', 'l-calc-2', 'l-calc-3'],
        requiredLessonIds: ['l-calc-1', 'l-calc-2', 'l-calc-3', 'l-calc-4'],
        bestScorePercent: null,
        passedAssessment: false,
        enrolledAt: '2026-03-14T10:00:00.000Z',
        completedAt: null,
        pausedAt: null,
      },
    ],
    totalXp: 845,
    xpToday: 120,
    studyMinutesToday: 25,
    dailyStudyGoalMinutes: 20,
    xpLedger: [
      {
        id: 'xp-mvp-1',
        eventType: 'lesson_completed',
        referenceId: 'l-macro-4',
        amount: 60,
        status: 'valid',
        ruleVersion: 'v1',
        description: 'Completed Open-Economy Taylor Rules',
        createdAt: nowIso,
      },
      {
        id: 'xp-mvp-2',
        eventType: 'assessment_passed',
        referenceId: 'ed-macro-en-v1',
        amount: 150,
        status: 'valid',
        ruleVersion: 'v1',
        description: 'Passed Monetary Policy Assessment (95.5%)',
        createdAt: nowIso,
      },
    ],
    streak: {
      currentStreak: 5,
      bestStreak: 12,
      lastActivityLocalDate: nowIso.slice(0, 10),
      timezone: 'Asia/Tashkent',
    },
    badges: [
      {
        id: 'bdg-mvp-1',
        badgeKey: 'course_complete_economics',
        title: 'Economics Finisher',
        criteria: 'Complete all required lessons and pass the assessment in an Economics course.',
        awardedAt: nowIso,
      },
    ],
  };
}

export function buildGuestCertificatesPayload(): {
  certificates: CertificateRecord[];
} {
  return {
    certificates: [
      {
        id: 'cert-mvp-macro-01',
        courseId: 'course-macro-stabilization',
        editionId: 'ed-macro-en-v1',
        editionVersion: 1,
        locale: 'en',
        recipientDisplayName: 'Guest User',
        courseTitle: 'Macroeconomic Stabilization & Monetary Policy',
        subject: 'Economics',
        level: 'Intermediate',
        publicToken: 'ECONOVA-MVP955A1B2C3',
        status: 'valid',
        shareEnabled: true,
        issuedAt: '2026-03-26T11:45:00.000Z',
        revokedAt: null,
        revokeReason: null,
        templateVersion: 'cert-template-v1',
      },
    ],
  };
}

export function buildCourseDetailPayload(
  courseId: string,
  locale: LocaleCode = 'en'
): CourseDetailResponse | null {
  const course =
    MVP_CATALOG_COURSES.find((c) => c.id === courseId || c.slug === courseId) ??
    MVP_CATALOG_COURSES[0];
  if (!course) return null;

  const targetLocale: LocaleCode = locale === 'uz' ? 'uz' : 'en';
  const edition = course.editions[targetLocale] ?? course.editions.en;
  if (!edition) return null;

  const lessonTitles = edition.lessonTitles || [];
  const lessons: LessonPublic[] = lessonTitles.map((title, idx) => ({
    id: `l-${course.id}-${targetLocale}-${idx + 1}`,
    editionId: edition.id,
    sequenceNum: idx + 1,
    title,
    summary: `${title} - Core theoretical principles and empirical applications.`,
    objectives: [
      `Master the core principles of ${title}`,
      'Apply mathematical and statistical frameworks to empirical data',
      'Analyze policy implications and economic trade-offs',
    ],
    bodyBlocks: [
      {
        kind: 'concept',
        heading: title,
        body: `Welcome to ${title}. This module builds rigorous economic intuitions with analytical models.`,
      },
    ],
    keyTerms: [
      {
        term: 'Equilibrium Condition',
        definition: 'State where market forces are balanced and economic variables remain unchanged.',
      },
    ],
    simulationType: 'none',
    videoUrl: null,
    captionsVtt: null,
    transcript: `Transcript for ${title}. Comprehensive lecture notes and interactive derivation.`,
    estimatedMinutes: Math.round(edition.estimatedMinutes / (lessonTitles.length || 1)),
    isRequired: true,
    provenance: null,
  }));

  const assessment: AssessmentPublic = {
    id: `assess-${edition.id}`,
    editionId: edition.id,
    title: `${edition.title} - Final Examination`,
    passingScorePercent: edition.passingScorePercent || 75,
    maxAttemptsPerDay: 3,
    retryPolicyText: 'Daily attempt quota: 3 attempts per 24-hour window.',
    version: 1,
    questions: [
      {
        id: `q-${edition.id}-1`,
        sequenceNum: 1,
        objectiveRef: 'obj-1',
        prompt: `In the context of ${course.subject}, which mechanism best stabilizes systemic deviations from long-run equilibrium?`,
        options: [
          'Counter-cyclical rule-based intervention',
          'Static unhedged liquidity expansion',
          'Pro-cyclical fiscal austerity during supply contractions',
          'Arbitrary discretionary price freezes',
        ],
      },
      {
        id: `q-${edition.id}-2`,
        sequenceNum: 2,
        objectiveRef: 'obj-2',
        prompt: 'What condition guarantees mathematical convergence in recursive dynamical models?',
        options: [
          'Spectral radius of the transition matrix strictly less than unity',
          'Unbounded accumulation of capital stock',
          'Strict monotonic divergence of state variables',
          'Indeterminate transversality conditions',
        ],
      },
    ],
  };

  return {
    course,
    edition,
    lessons,
    assessment,
  };
}

/**
 * Resolves a fallback JSON payload when the frontend runs in a static or serverless
 * preview where an API endpoint is missing (HTTP 404) or unreachable.
 */
export function resolveMvpApiFallbackPayload(
  pathname: string,
  searchParams?: URLSearchParams
): unknown | null {
  if (pathname === '/api/health') {
    return buildHealthPayload();
  }
  if (pathname === '/api/auth/me') {
    return buildAuthMePayload();
  }
  if (pathname === '/api/catalog') {
    return buildCatalogPayload();
  }
  if (pathname === '/api/leaderboards') {
    const courseId = searchParams?.get('courseId') || 'all';
    return buildLeaderboardsPayload(courseId);
  }
  if (pathname === '/api/me/overview') {
    return buildGuestOverviewPayload();
  }
  if (pathname === '/api/me/certificates') {
    return buildGuestCertificatesPayload();
  }
  if (pathname === '/api/me/referrals') {
    return {
      myCode: 'ECONOVA-MVP',
      referralsCount: 3,
      claimedByMe: null,
    };
  }

  const courseMatch = pathname.match(/^\/api\/courses\/([^/]+)\/editions\/([^/]+)/);
  if (courseMatch) {
    const courseId = decodeURIComponent(courseMatch[1]);
    const locale = (decodeURIComponent(courseMatch[2]) || 'en') as LocaleCode;
    return buildCourseDetailPayload(courseId, locale);
  }

  return null;
}
