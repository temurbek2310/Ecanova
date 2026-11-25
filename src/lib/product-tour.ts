import type { LocaleCode } from '../shared/types';

export type TourTrack = 'Economics' | 'Mathematics' | 'Business';

export type TourStepId = 'welcome' | 'daily-goal' | 'catalog' | 'toolkit' | 'certificates';

export interface TourStepConfig {
  id: TourStepId;
  stepNumber: number;
  targetSelector: string | null;
}

export const TOTAL_TOUR_STEPS = 5;

export const TOUR_STEPS: readonly TourStepConfig[] = [
  { id: 'welcome', stepNumber: 1, targetSelector: null },
  { id: 'daily-goal', stepNumber: 2, targetSelector: '[data-tour-id="tour-daily-goal"]' },
  { id: 'catalog', stepNumber: 3, targetSelector: '[data-tour-id="tour-catalog"]' },
  { id: 'toolkit', stepNumber: 4, targetSelector: '[data-tour-id="tour-toolkit"]' },
  { id: 'certificates', stepNumber: 5, targetSelector: '[data-tour-id="tour-certificates"]' },
] as const;

/** Order of a step in the full tour (keeps navigation stable when steps are skipped). */
export function getTourStepOrder(id: TourStepId): number {
  return TOUR_STEPS.findIndex((s) => s.id === id);
}

/** A target is usable only when it is mounted and has a real box (hidden / display:none ⇒ 0×0). */
export function isTourTargetMeasurable(
  rect: { width: number; height: number } | null | undefined
): boolean {
  return Boolean(rect && rect.width > 0 && rect.height > 0);
}

/**
 * Steps that can actually be shown right now. The welcome step (no selector)
 * is always kept; a step with a selector is kept only when its target exists.
 */
export function resolveActiveSteps(
  isTargetAvailable: (step: TourStepConfig) => boolean
): TourStepConfig[] {
  return TOUR_STEPS.filter((step) => step.targetSelector === null || isTargetAvailable(step));
}

export function areSameTourSteps(
  a: readonly TourStepConfig[],
  b: readonly TourStepConfig[]
): boolean {
  return a.length === b.length && a.every((step, i) => step.id === b[i].id);
}

/**
 * When the step on screen loses its target, move to the next remaining step
 * (in tour order), or the last remaining one if none follow.
 */
export function resolveStepAfterRemoval(
  nextActive: readonly TourStepConfig[],
  currentId: TourStepId
): TourStepId {
  if (nextActive.some((s) => s.id === currentId)) return currentId;
  const currentOrder = getTourStepOrder(currentId);
  const following = nextActive.find((s) => getTourStepOrder(s.id) > currentOrder);
  return (following ?? nextActive[nextActive.length - 1] ?? TOUR_STEPS[0]).id;
}

export const TOUR_STORAGE_PREFIX = 'econova:product-tour:v1:';
export const PREFERRED_TRACK_KEY = 'econova:preferred-track';

export function getTourStorageKey(userId?: string | null): string {
  const cleanId = (userId || 'guest').trim() || 'guest';
  return `${TOUR_STORAGE_PREFIX}${cleanId}`;
}

export function isTourCompleted(userId?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = getTourStorageKey(userId);
    const val = window.localStorage.getItem(key);
    return Boolean(val);
  } catch {
    return false;
  }
}

export function markTourCompleted(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getTourStorageKey(userId);
    window.localStorage.setItem(
      key,
      JSON.stringify({ completed: true, timestamp: Date.now() })
    );
  } catch {
    // Ignore localStorage access restriction
  }
}

export function resetTour(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getTourStorageKey(userId);
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage restriction
  }
}

export function shouldAutoStartTour(options: {
  isAuthenticated: boolean;
  activeTab: string;
  userId?: string | null;
  authModalOpen?: boolean;
  /** Any other modal/drawer that must not be stacked under the tour. */
  otherOverlayOpen?: boolean;
}): boolean {
  if (!options.isAuthenticated) return false;
  if (options.activeTab !== 'overview') return false;
  if (options.authModalOpen) return false;
  if (options.otherOverlayOpen) return false;
  return !isTourCompleted(options.userId);
}

function isTourTrack(value: unknown): value is TourTrack {
  return value === 'Economics' || value === 'Mathematics' || value === 'Business';
}

export function getPreferredTrackKey(userId?: string | null): string {
  const cleanId = (userId || '').trim();
  return cleanId ? `${PREFERRED_TRACK_KEY}:${cleanId}` : PREFERRED_TRACK_KEY;
}

/** Per-user preference; falls back to the legacy global key written by earlier builds. */
export function getPreferredTrack(userId?: string | null): TourTrack | null {
  if (typeof window === 'undefined') return null;
  try {
    const scoped = window.localStorage.getItem(getPreferredTrackKey(userId));
    if (isTourTrack(scoped)) return scoped;
    const legacy = window.localStorage.getItem(PREFERRED_TRACK_KEY);
    if (isTourTrack(legacy)) return legacy;
  } catch {
    // Ignore storage error
  }
  return null;
}

export function setPreferredTrack(track: TourTrack, userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getPreferredTrackKey(userId), track);
  } catch {
    // Ignore storage error
  }
}

export function clampTourStep(step: number, total: number = TOTAL_TOUR_STEPS): number {
  if (typeof step !== 'number' || isNaN(step)) return 1;
  return Math.min(Math.max(1, total), Math.max(1, Math.floor(step)));
}

export interface TourStepCopy {
  telemetryTag: string;
  title: string;
  description: string;
  /** Used instead of `description` on narrow (mobile) viewports when the desktop wording doesn't apply. */
  mobileDescription?: string;
}

export interface TourCopy {
  badgeTemplate: string;
  targetActive: string;
  skip: string;
  back: string;
  next: string;
  finish: string;
  replay: string;
  /** Header trigger label / tooltip. */
  openLabel: string;
  /** Shortcuts-modal action button. */
  launch: string;
  /** Accessible name of the tour dialog. */
  dialogLabel: string;
  closeLabel: string;
  /** Desktop keyboard hint line. */
  keyHints: string;
  /** Profile → replay card. */
  replayCard: { title: string; description: string; button: string };
  trackSelectionPrompt: string;
  tracks: Record<TourTrack, { label: string; desc: string }>;
  steps: Record<TourStepId, TourStepCopy>;
}

export const TOUR_COPY_EN: TourCopy = {
  badgeTemplate: 'CALIBRATION // {current} OF {total}',
  targetActive: 'TARGET // ACTIVE',
  skip: 'Skip Tour',
  back: 'Back',
  next: 'Next',
  finish: 'Start Learning',
  replay: 'Replay Product Tour',
  openLabel: 'Product Tour',
  launch: 'Launch Tour',
  dialogLabel: 'Product tour',
  closeLabel: 'Close tour',
  keyHints: '← / → navigate · Esc skip',
  replayCard: {
    title: 'Architectural Product Tour',
    description:
      'Relaunch the guided walkthrough of the overview dashboard, courses, and study tools.',
    button: 'Replay Tour',
  },
  trackSelectionPrompt: 'Pick the track you want to start with:',
  tracks: {
    Economics: {
      label: 'Economics',
      desc: 'Micro, Macro & Econometrics with real-time interactive equilibrium models.',
    },
    Mathematics: {
      label: 'Mathematics',
      desc: 'Linear algebra, calculus & optimization with chalkboard precision.',
    },
    Business: {
      label: 'Business',
      desc: 'Financial modeling, valuation, corporate strategy & entrepreneurial cases.',
    },
  },
  steps: {
    welcome: {
      telemetryTag: 'CALIBRATION',
      title: 'Welcome to ECONOVA',
      description:
        'Master Economics, Mathematics, and Business through interactive simulations, a rigorous curriculum, and verifiable certificates.',
    },
    'daily-goal': {
      telemetryTag: 'TELEMETRY',
      title: 'Daily Goal & XP Progress',
      description:
        'Set a daily study-minute target and keep your streak alive. Your XP chart starts filling in after your first lesson — nothing here is pre-filled, it is all your real progress.',
    },
    catalog: {
      telemetryTag: 'CURRICULUM',
      title: 'Interactive Courses & Level Check',
      description:
        'Explore interactive lessons with live economic curves, chalkboard math, and business models. The first time you open a course in a subject, a quick 2-minute Level Check can point you to the right starting level — or skip it and jump straight in.',
    },
    toolkit: {
      telemetryTag: 'STUDY TOOLKIT',
      title: 'Focus Timer & Ambient Soundscape',
      description:
        'Start a Pomodoro focus session with a generative ambient soundscape right from the header. Notes and your AI Companion are always one click away.',
      mobileDescription:
        'Find your focus timer and ambient soundscape in Profile and inside lessons. Notes and your AI Companion are always one click away.',
    },
    certificates: {
      telemetryTag: 'ACCREDITATION',
      title: 'XP & Verifiable Certificates',
      description:
        'Earn non-cash XP for completed lessons, and unlock cryptographically signed certificates with public QR verification when you finish a course.',
    },
  },
};

export const TOUR_COPY_UZ: TourCopy = {
  badgeTemplate: 'KALIBROVKA // {current} / {total}',
  targetActive: 'NISHON // FAOL',
  skip: 'O‘tkazib yuborish',
  back: 'Orqaga',
  next: 'Keyingisi',
  finish: 'O‘qishni boshlash',
  replay: 'Mahsulot ekskursiyasini qayta ko‘rish',
  openLabel: 'Mahsulot ekskursiyasi',
  launch: 'Boshlash',
  dialogLabel: 'Mahsulot ekskursiyasi',
  closeLabel: 'Ekskursiyani yopish',
  keyHints: '← / → almashtirish · Esc o‘tkazish',
  replayCard: {
    title: 'Mahsulot bo‘ylab ekskursiya',
    description:
      'Bosh sahifa, kurslar va o‘quv vositalari bo‘ylab ko‘rsatmalarni qayta boshlang.',
    button: 'Ekskursiyani qayta ko‘rish',
  },
  trackSelectionPrompt: 'Boshlash uchun yo‘nalishingizni tanlang:',
  tracks: {
    Economics: {
      label: 'Iqtisodiyot',
      desc: 'Haqiqiy vaqtdagi muvozanat modellariga ega mikro, makro va ekonometrika.',
    },
    Mathematics: {
      label: 'Matematika',
      desc: 'Chiziqli algebra, matematik tahlil va optimallashtirish.',
    },
    Business: {
      label: 'Biznes',
      desc: 'Moliyaviy modellashtirish, baholash va korporativ strategiya.',
    },
  },
  steps: {
    welcome: {
      telemetryTag: 'KALIBRLASH',
      title: 'ECONOVA ga xush kelibsiz',
      description:
        'Iqtisodiyot, matematika va biznesni interaktiv modellar, chuqur o‘quv dasturi va tasdiqlanuvchi sertifikatlar orqali o‘rganing.',
    },
    'daily-goal': {
      telemetryTag: 'TELEMETRIYA',
      title: 'Kunlik maqsad va XP natijalari',
      description:
        'Kunlik o‘qish daqiqasi maqsadini belgilang va davomiylikni (streak) saqlang. XP grafigi birinchi darsingizdan keyin to‘la boshlaydi — bu yerda hech narsa oldindan to‘ldirilmagan, faqat sizning haqiqiy natijalaringiz.',
    },
    catalog: {
      telemetryTag: 'O‘QUV DASTURI',
      title: 'Interaktiv kurslar va daraja testi',
      description:
        'Jonli iqtisodiy grafiklar, matematik chizmalar va biznes modellariga ega interaktiv darslarni o‘rganing. Fan bo‘yicha birinchi kursni ochganingizda 2 daqiqalik daraja testi sizga mos boshlang‘ich nuqtani topadi — xohlasangiz o‘tkazib yuboring.',
    },
    toolkit: {
      telemetryTag: 'O‘QUV USKUNALARI',
      title: 'Fokus taymeri va sokin ovozlar',
      description:
        'Sarlavhadagi boshqaruvdan Pomodoro fokus seansini generativ sokin fon ovozi bilan ishga tushiring. Qaydlar va AI Companion doimo bir tugma masofasida.',
      mobileDescription:
        'Fokus taymeri va sokin fon ovozi Profil bo‘limida va dars ichida mavjud. Qaydlar va AI Companion doimo bir tugma masofasida.',
    },
    certificates: {
      telemetryTag: 'AKKREDITATSIYA',
      title: 'XP va tasdiqlanuvchi sertifikatlar',
      description:
        'Yakunlangan darslar uchun naqd pulsiz XP to‘plang va kursni tugatganingizda ommaviy QR tekshiruviga ega kriptografik imzolangan sertifikatni oling.',
    },
  },
};

export const TOUR_COPY_RU: TourCopy = {
  badgeTemplate: 'КАЛИБРОВКА // {current} ИЗ {total}',
  targetActive: 'ОБЪЕКТ // АКТИВЕН',
  skip: 'Пропустить',
  back: 'Назад',
  next: 'Далее',
  finish: 'Начать обучение',
  replay: 'Пройти тур заново',
  openLabel: 'Обзорный тур',
  launch: 'Запустить тур',
  dialogLabel: 'Обзорный тур по платформе',
  closeLabel: 'Закрыть тур',
  keyHints: '← / → перейти · Esc пропустить',
  replayCard: {
    title: 'Обзорный тур по платформе',
    description: 'Запустите заново пошаговый обзор панели, курсов и учебных инструментов.',
    button: 'Пройти заново',
  },
  trackSelectionPrompt: 'Выберите направление, с которого хотите начать:',
  tracks: {
    Economics: {
      label: 'Экономика',
      desc: 'Микро-, макроэкономика и эконометрика с интерактивными графиками равновесия.',
    },
    Mathematics: {
      label: 'Математика',
      desc: 'Линейная алгебра, математический анализ и теория оптимизации.',
    },
    Business: {
      label: 'Бизнес',
      desc: 'Финансовое моделирование, оценка стоимости и корпоративная стратегия.',
    },
  },
  steps: {
    welcome: {
      telemetryTag: 'КАЛИБРОВКА',
      title: 'Добро пожаловать в ECONOVA',
      description:
        'Осваивайте экономику, математику и бизнес с помощью интерактивных моделей, академической программы и проверяемых сертификатов.',
    },
    'daily-goal': {
      telemetryTag: 'ТЕЛЕМЕТРИЯ',
      title: 'Ежедневная цель и прогресс XP',
      description:
        'Задайте дневную норму минут и поддерживайте серию занятий. График XP начнёт заполняться после первого урока — здесь ничего не нарисовано заранее, только ваш настоящий прогресс.',
    },
    catalog: {
      telemetryTag: 'УЧЕБНАЯ ПРОГРАММА',
      title: 'Интерактивные курсы и проверка уровня',
      description:
        'Изучайте интерактивные уроки с живыми графиками, математическими выкладками и бизнес-моделями. При первом открытии курса по предмету 2-минутная проверка уровня подскажет, с чего начать, — или пропустите её и переходите сразу к курсу.',
    },
    toolkit: {
      telemetryTag: 'ИНСТРУМЕНТЫ',
      title: 'Таймер фокуса и эмбиент-звуки',
      description:
        'Запускайте фокус-сессию Pomodoro с генеративным эмбиент-звуком прямо из шапки. Заметки и AI-ассистент всегда под рукой.',
      mobileDescription:
        'Таймер фокуса и эмбиент-звуки доступны в профиле и внутри уроков. Заметки и AI-ассистент всегда под рукой.',
    },
    certificates: {
      telemetryTag: 'СЕРТИФИКАЦИЯ',
      title: 'XP и проверяемые сертификаты',
      description:
        'Зарабатывайте XP (без денежной стоимости) за пройденные уроки и получайте криптографически подписанные сертификаты с публичной QR-проверкой после завершения курса.',
    },
  },
};

export function getTourCopy(locale: LocaleCode | string): TourCopy {
  const normalized = (locale || '').toLowerCase().trim();
  if (normalized === 'uz') return TOUR_COPY_UZ;
  if (normalized === 'ru') return TOUR_COPY_RU;
  return TOUR_COPY_EN;
}
