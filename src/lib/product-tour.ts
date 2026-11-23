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
}): boolean {
  if (!options.isAuthenticated) return false;
  if (options.activeTab !== 'overview') return false;
  if (options.authModalOpen) return false;
  return !isTourCompleted(options.userId);
}

export function getPreferredTrack(): TourTrack | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.localStorage.getItem(PREFERRED_TRACK_KEY);
    if (val === 'Economics' || val === 'Mathematics' || val === 'Business') {
      return val;
    }
  } catch {
    // Ignore storage error
  }
  return null;
}

export function setPreferredTrack(track: TourTrack): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFERRED_TRACK_KEY, track);
  } catch {
    // Ignore storage error
  }
}

export function clampTourStep(step: number): number {
  if (typeof step !== 'number' || isNaN(step)) return 1;
  return Math.min(TOTAL_TOUR_STEPS, Math.max(1, Math.floor(step)));
}

export interface TourStepCopy {
  telemetryTag: string;
  title: string;
  description: string;
}

export interface TourCopy {
  badgeTemplate: string;
  targetActive: string;
  skip: string;
  back: string;
  next: string;
  finish: string;
  replay: string;
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
  trackSelectionPrompt: 'Select your primary focus track to personalize your journey:',
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
      telemetryTag: 'CALIBRATION // STEP 01',
      title: 'Welcome to ECONOVA',
      description:
        'Master Economics, Mathematics, and Business through interactive simulations, rigorous curriculum, and verifiable certificates. Select your core focus track below:',
    },
    'daily-goal': {
      telemetryTag: 'TELEMETRY // STEP 02',
      title: 'Daily Study Goal & Weakness Radar',
      description:
        'Maintain your study streak by hitting your daily minute target. Below, the algorithmic Weakness Detection Radar analyzes assessment outcomes and pinpoints concepts to review.',
    },
    catalog: {
      telemetryTag: 'CURRICULUM // STEP 03',
      title: 'Interactive Models & Course Catalog',
      description:
        'Explore interactive lessons featuring real-time economic curves, chalkboard calculations, and business bento workspaces. Jump into any course to start hands-on learning.',
    },
    toolkit: {
      telemetryTag: 'STUDY TOOLKIT // STEP 04',
      title: 'Focus Timer & Ambient Soundscape',
      description:
        'Level up your deep work: trigger Pomodoro focus sessions paired with generative ambient soundscapes right from the header. Notes and your AI Companion are always one click away.',
    },
    certificates: {
      telemetryTag: 'ACCREDITATION // STEP 05',
      title: 'XP Streaks & Verifiable Certificates',
      description:
        'Earn non-cash XP as you complete lessons, climb cohort leaderboards, and unlock cryptographically signed certificates with public QR verification upon mastering courses.',
    },
  },
};

export const TOUR_COPY_UZ: TourCopy = {
  badgeTemplate: 'KALIBROVKA // {current} / {total}',
  targetActive: 'NISHO N // FAOL',
  skip: 'O‘tkazib yuborish',
  back: 'Orqaga',
  next: 'Keyingisi',
  finish: 'O‘qishni boshlash',
  replay: 'Mahsulot ekskursiyasini qayta ko‘rish',
  trackSelectionPrompt: 'O‘quv jarayonini moslashtirish uchun asosiy yo‘nalishingizni tanlang:',
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
      telemetryTag: 'KALIBROVKA // 01-BOSQICH',
      title: 'ECONOVA ga xush kelibsiz',
      description:
        'Iqtisodiyot, matematika va biznesni interaktiv modellar, chuqur o‘quv dasturi va tasdiqlanuvchi sertifikatlar orqali o‘rganing. Asosiy yo‘nalishingizni tanlang:',
    },
    'daily-goal': {
      telemetryTag: 'TELEMETRIYA // 02-BOSQICH',
      title: 'Kunlik o‘quv maqsadi va zaif mavzular radari',
      description:
        'Kunlik daqiqa maqsadiga erishib, o‘quv davomiyligingizni (streak) saqlang. Pastdagi Zaiflik Radari baholash natijalarini tahlil qilib, qayta o‘rganish lozim bo‘lgan mavzularni ko‘rsatadi.',
    },
    catalog: {
      telemetryTag: 'O‘QUV DASTURI // 03-BOSQICH',
      title: 'Interaktiv darslar va kurslar katalogi',
      description:
        'Haqiqiy vaqtdagi iqtisodiy grafiklar, matematik chizmalar va biznes boshqaruv modellariga ega interaktiv darslarni o‘rganing. Amaliy bilim olish uchun istalgan kursga kiring.',
    },
    toolkit: {
      telemetryTag: 'O‘QUV USKUNALARI // 04-BOSQICH',
      title: 'Fokus taymeri va sokin ovozlar',
      description:
        'Chuqur diqqat bilan o‘rganing: sarlavhadagi boshqaruvdan Pomodoro fokus taymeri va generativ sokin fon musiqasini ishga tushiring. Qaydlar va AI Study Companion doimo bir tugma masofasida.',
    },
    certificates: {
      telemetryTag: 'AKKREDITATSIYA // 05-BOSQICH',
      title: 'XP davomiyligi va tasdiqlanuvchi sertifikatlar',
      description:
        'Darslarni tugatganingiz sari XP to‘plang, peshqadamlar jadvalida ko‘tariling va kurslarni yakunlab ommaviy QR tekshiruviga ega raqamli sertifikatlarni qo‘lga kiriting.',
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
  trackSelectionPrompt: 'Выберите основное направление для персонализации программы:',
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
      telemetryTag: 'КАЛИБРОВКА // ЭТАП 01',
      title: 'Добро пожаловать в ECONOVA',
      description:
        'Осваивайте экономику, математику и бизнес с помощью интерактивных моделей, академической программы и проверяемых сертификатов. Выберите ключевой трек:',
    },
    'daily-goal': {
      telemetryTag: 'ТЕЛЕМЕТРИЯ // ЭТАП 02',
      title: 'Ежедневная цель и радар слабых тем',
      description:
        'Поддерживайте непрерывную серию занятий, выполняя ежедневную норму минут. Алгоритмический радар выявляет пробелы в тестах и подсказывает темы для повторения.',
    },
    catalog: {
      telemetryTag: 'УЧЕБНАЯ ПРОГРАММА // ЭТАП 03',
      title: 'Интерактивные курсы и каталог',
      description:
        'Изучайте интерактивные уроки с динамическими кривыми, математическими выкладками и бизнес-моделями. Откройте любой курс для практического обучения.',
    },
    toolkit: {
      telemetryTag: 'ИНСТРУМЕНТЫ // ЭТАП 04',
      title: 'Таймер фокуса и эмбиент-звуки',
      description:
        'Погрузитесь в глубокую концентрацию: запускайте таймер Pomodoro в паре с генеративным эмбиент-звучанием прямо из шапки. Заметки и AI-ассистент всегда под рукой.',
    },
    certificates: {
      telemetryTag: 'СЕРТИФИКАЦИЯ // ЭТАП 05',
      title: 'Серии XP и проверяемые сертификаты',
      description:
        'Зарабатывайте академический XP за пройденные уроки, поднимайтесь в рейтинге и получайте криптографически подписанные сертификаты с QR-верификацией подлинности.',
    },
  },
};

export function getTourCopy(locale: LocaleCode | string): TourCopy {
  const normalized = (locale || '').toLowerCase().trim();
  if (normalized === 'uz') return TOUR_COPY_UZ;
  if (normalized === 'ru') return TOUR_COPY_RU;
  return TOUR_COPY_EN;
}
