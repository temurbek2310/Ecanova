import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Command, FileCheck2, Languages, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEconovaGSAP } from '@/hooks/useEconovaGSAP';
import { getActiveLenisInstance } from '../../lib/scroll-sync';
import {
  ENTRANCE_CANVAS_WAIT_MS,
  ENTRANCE_DOM_END_S,
  ENTRANCE_TIMELINE,
  createLandingEntrance,
} from '../../lib/landing-entrance';
import { applyDocumentLocale, persistLocalePreference } from '../../lib/i18n';
import { apiFetch, getCachedUserSummary } from '../../lib/auth-client';
import type { CourseCatalogItem, CourseLevel, LocaleCode, Subject } from '../../shared/types';
import { EngineSandbox } from './EngineSandbox';
import type { SandboxTrack } from './EngineSandbox';
import { FooterWordmarkCanvas } from './FooterWordmarkCanvas';
import './landing.css';

gsap.registerPlugin(ScrollTrigger);

/**
 * The WebGL constellation is a decorative background layer: load its module in its own chunk so it
 * never sits on the critical path of the first paint (the canvas itself also defers its GPU boot to
 * an idle period and fades in on its first frame).
 */
const ConstellationCanvas = lazy(() => import('./ConstellationCanvas'));

export interface LandingPageProps {
  locale: LocaleCode;
  onToggleLocale: (next: LocaleCode) => void;
  /** Navigates to /overview. */
  onEnterApp: () => void;
  /** Navigates to /login with target redirectTo. */
  onSignIn: (redirectTo?: string) => void;
  isAuthenticated?: boolean;
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

interface Chapter {
  /** Monospace module tag, e.g. "ECONOMICS" → rendered as `01 // ECONOMICS`. */
  tag: string;
  headline: string;
  body: string;
  topics: [string, string, string];
}

interface Capability {
  title: string;
  module: string;
  body: string;
}

type FooterAction =
  | 'econ'
  | 'math'
  | 'biz'
  | 'overview'
  | 'architecture'
  | 'signin'
  | 'command'
  | 'community'
  | 'github'
  | 'certificates';

interface FooterColumn {
  title: string;
  links: Array<{ label: string; action: FooterAction }>;
}

interface LandingCopy {
  nav: { tracks: string; architecture: string; start: string; signIn: string; launch: string; dashboard: string };
  hero: {
    badge: string;
    /** Each line: plain lead + accented tail. */
    lines: [[string, string], [string, string]];
    body: string;
    cta: string;
    /** Signed-in replacement for `cta`. */
    continue: string;
    explore: string;
    proof: [string, string, string];
  };
  tracks: { badge: string; headline: string; explore: string };
  chapters: [Chapter, Chapter, Chapter];
  architecture: {
    badge: string;
    headline: string;
    body: string;
    items: [Capability, Capability, Capability, Capability];
  };
  closing: {
    badge: string;
    headline: string;
    body: string;
    cta: string;
    signIn: string;
    /** Signed-in replacements for `body` / `cta` / `signIn`. */
    continueBody: string;
    continue: string;
    browse: string;
  };
  footer: {
    tagline: string;
    /** Monospace telemetry pill, e.g. `[ ENGINE :: ONLINE · O‘Z / EN ]`. */
    status: string;
    language: string;
    /** Tracks · Platform · Connect. */
    columns: [FooterColumn, FooterColumn, FooterColumn];
    /** Bottom-bar line after `© {year} ECONOVA ·`. */
    legal: string;
    backToTop: string;
  };
  /** Chapter rail labels, in RAIL_TARGETS order (00–05). */
  rail: { label: string; items: [string, string, string, string, string, string] };
  /** `<title>` + `<meta name="description">` while the landing page is mounted. */
  meta: { title: string; description: string };
  /** Screen-reader-only landmark / control names. */
  a11y: { primaryNav: string; footerNav: string; language: string };
  /** Trust & transparency: per-track syllabus + server-verified credential specimen. */
  trust: {
    badge: string;
    headline: string;
    body: string;
    syllabus: {
      /** Courses · Lessons · Study time (values come from the live catalog). */
      stats: [string, string, string];
      hoursUnit: string;
      levels: string;
      levelNames: Record<CourseLevel, string>;
      skillsTitle: string;
      profileTitle: string;
      open: string;
      /** Card order: Economics, Mathematics, Business. */
      tracks: [TrackSyllabus, TrackSyllabus, TrackSyllabus];
    };
    credential: {
      heading: string;
      body: string;
      tabsLabel: string;
      specimen: string;
      certTitle: string;
      trackNames: [string, string, string];
      recipientLabel: string;
      recipient: string;
      issuedLabel: string;
      scoreLabel: string;
      idLabel: string;
      hashLabel: string;
      /** Idle · checking · verified. */
      status: [string, string, string];
      steps: [string, string, string];
      run: string;
      rerun: string;
      note: string;
      verifyReal: string;
    };
  };
}

interface TrackSyllabus {
  skills: [string, string, string, string];
  profile: string;
}

const COPY: Record<LocaleCode, LandingCopy> = {
  en: {
    trust: {
      badge: '[ TRUST & TRANSPARENCY ]',
      headline: 'Know exactly what you study — and what you earn.',
      body: 'Every track publishes its syllabus up front, and every credential can be checked against the server in seconds.',
      syllabus: {
        stats: ['Courses', 'Lessons', 'Study time'],
        hoursUnit: 'h',
        levels: 'Levels',
        levelNames: { Beginner: 'Beginner', Intermediate: 'Intermediate', Advanced: 'Advanced' },
        skillsTitle: 'Core analytical skills',
        profileTitle: 'Who it’s for',
        open: 'Open track',
        tracks: [
          {
            skills: [
              'Model supply, demand and market equilibrium',
              'Read macro indicators: inflation, output, rates',
              'Reason strategically with game theory',
              'Weigh policy trade-offs with data',
            ],
            profile: 'Students and early-career analysts who want to explain how markets and policy really move.',
          },
          {
            skills: [
              'Work fluently with vectors and matrices',
              'Quantify uncertainty with probability',
              'Optimise under constraints with calculus',
              'Build and test quantitative models',
            ],
            profile: 'Learners preparing for quantitative study, data roles or exams that demand rigorous problem-solving.',
          },
          {
            skills: [
              'Calculate unit economics and break-even',
              'Allocate capital across competing projects',
              'Design operating systems that scale',
              'Turn financial models into strategy',
            ],
            profile: 'Founders, managers and business students who want numbers behind every strategic decision.',
          },
        ],
      },
      credential: {
        heading: 'Server-verified credentials',
        body: 'Finish a track and receive a credential with a unique ID and verification hash. Anyone can confirm it against the server — no PDF to trust blindly.',
        tabsLabel: 'Sample credential',
        specimen: 'SPECIMEN',
        certTitle: 'Certificate of Completion',
        trackNames: ['Economics Track', 'Mathematics Track', 'Business Track'],
        recipientLabel: 'Recipient',
        recipient: 'Sample Learner',
        issuedLabel: 'Issued',
        scoreLabel: 'Final score',
        idLabel: 'Credential ID',
        hashLabel: 'Verification hash',
        status: ['Ready to verify', 'Checking…', 'Verified on Server'],
        steps: [
          'Credential ID found on the server',
          'Learner and track details match the record',
          'Status: valid, not revoked',
        ],
        run: 'Run verification',
        rerun: 'Run again',
        note: 'Specimen: this check is simulated in your browser. Real credentials are verified live by the server.',
        verifyReal: 'Verify a real credential',
      },
    },
    meta: {
      title: 'ECONOVA — Bilingual Academic Engine for Economics, Mathematics & Business',
      description:
        'Master Economics, Mathematics and Business on one bilingual (Uzbek / English) platform — structured tracks, offline sync and server-verified certificates.',
    },
    a11y: { primaryNav: 'Primary', footerNav: 'Footer', language: 'Language' },
    nav: {
      tracks: 'Tracks',
      architecture: 'Architecture',
      start: 'Get Started',
      signIn: 'Sign In',
      launch: 'Open App',
      dashboard: 'Dashboard',
    },
    hero: {
      badge: '[ BILINGUAL ACADEMIC ENGINE :: O‘Z / EN ]',
      lines: [
        ['Systemic ', 'thinking.'],
        ['Scalable ', 'models.'],
      ],
      body: 'Master Economics, Mathematics and Business in one bilingual engine — every lesson, syllabus and credential verified on the server.',
      cta: 'Launch Platform',
      continue: 'Continue Learning',
      explore: 'Explore Tracks',
      proof: ['3 Core Tracks', 'O‘Z / EN', 'Verified Certificates'],
    },
    tracks: { badge: '[ CORE DISCIPLINES ]', headline: 'Three tracks. One system.', explore: 'Explore Track' },
    chapters: [
      {
        tag: 'ECONOMICS',
        headline: 'Markets, modeled as living systems.',
        body: 'From macro cycles to strategic games, learn how incentives settle into equilibrium — and exactly what breaks it.',
        topics: ['Macroeconomics', 'Game Theory', 'Market Equilibrium'],
      },
      {
        tag: 'MATHEMATICS',
        headline: 'The structure beneath every decision.',
        body: 'Vectors, probability and models, built up from first principles until uncertainty becomes something you can compute.',
        topics: ['Linear Algebra', 'Probability', 'Quantitative Modeling'],
      },
      {
        tag: 'BUSINESS',
        headline: 'Strategy that scales, not just sounds right.',
        body: 'Unit economics to capital allocation: the numbers, trade-offs and system design behind companies that compound.',
        topics: ['Unit Economics', 'Capital Allocation', 'Strategic Systems'],
      },
    ],
    architecture: {
      badge: '[ PLATFORM ARCHITECTURE ]',
      headline: 'Built like infrastructure.',
      body: 'The same engine that powers the dashboard — fast, bilingual, resilient and verifiable.',
      items: [
        {
          title: '⌘K Spotlight CommandBar',
          module: 'NAVIGATION',
          body: 'Instant, keyboard-first navigation across every course, lesson and assessment.',
        },
        {
          title: 'Dual-Edition Publishing (O‘Z / EN)',
          module: 'CONTENT',
          body: 'Native Uzbek and English academic editions, published and kept in sync side by side.',
        },
        {
          title: 'Offline Data Reconciliation (Sync HUD)',
          module: 'SYNC',
          body: 'Local-first persistence that reconciles cleanly the moment you reconnect — with live status in the HUD.',
        },
        {
          title: 'Server-Verified PDF Certificates',
          module: 'CREDENTIALS',
          body: 'Print-ready syllabi and certificates whose authenticity is checked on the server.',
        },
      ],
    },
    closing: {
      badge: '[ GET STARTED ]',
      headline: 'Ready to think in systems?',
      body: 'Create your account and start your first track in seconds.',
      cta: 'Create Account',
      signIn: 'Sign In',
      continueBody: 'Pick up exactly where you left off, or open a new track.',
      continue: 'Continue Learning',
      browse: 'Browse Courses',
    },
    footer: {
      tagline: 'A bilingual academic engine for Economics, Mathematics and Business.',
      status: '[ ENGINE :: ONLINE · O‘Z / EN ]',
      language: 'Language',
      columns: [
        {
          title: 'Tracks',
          links: [
            { label: 'Economics', action: 'econ' },
            { label: 'Mathematics', action: 'math' },
            { label: 'Business', action: 'biz' },
          ],
        },
        {
          title: 'Platform',
          links: [
            { label: 'Overview', action: 'overview' },
            { label: 'Architecture', action: 'architecture' },
            { label: 'Sign In', action: 'signin' },
            { label: 'Command palette', action: 'command' },
          ],
        },
        {
          title: 'Connect',
          links: [
            { label: 'Community', action: 'community' },
            { label: 'GitHub', action: 'github' },
            { label: 'Verified Certificates', action: 'certificates' },
          ],
        },
      ],
      legal: 'Systemic Academic Engine',
      backToTop: 'Back to top',
    },
    rail: { label: 'Sections', items: ['Intro', 'Economics', 'Mathematics', 'Business', 'Architecture', 'Get started'] },
  },
  uz: {
    trust: {
      badge: '[ ISHONCH VA SHAFFOFLIK ]',
      headline: 'Nimani o‘rganishingiz va nimaga erishishingizni aniq biling.',
      body: 'Har bir yo‘nalish sillabusini oldindan e’lon qiladi, har bir sertifikatni esa serverda bir necha soniyada tekshirish mumkin.',
      syllabus: {
        stats: ['Kurslar', 'Darslar', 'O‘qish vaqti'],
        hoursUnit: 'soat',
        levels: 'Darajalar',
        levelNames: { Beginner: 'Boshlang‘ich', Intermediate: 'O‘rta', Advanced: 'Yuqori' },
        skillsTitle: 'Asosiy tahliliy ko‘nikmalar',
        profileTitle: 'Kimlar uchun',
        open: 'Yo‘nalishni ochish',
        tracks: [
          {
            skills: [
              'Talab, taklif va bozor muvozanatini modellashtirish',
              'Makro ko‘rsatkichlarni o‘qish: inflyatsiya, ishlab chiqarish, foiz stavkalari',
              'O‘yinlar nazariyasi bilan strategik fikrlash',
              'Siyosat murosalarini ma’lumotlar asosida baholash',
            ],
            profile: 'Bozorlar va iqtisodiy siyosat qanday harakatlanishini tushuntirishni istagan talabalar va yosh tahlilchilar.',
          },
          {
            skills: [
              'Vektor va matritsalar bilan erkin ishlash',
              'Noaniqlikni ehtimollik orqali o‘lchash',
              'Cheklovlar ostida differensial hisob bilan optimallashtirish',
              'Miqdoriy modellar qurish va sinash',
            ],
            profile: 'Miqdoriy ta’lim, ma’lumotlar bilan ishlash yoki qat’iy masala yechishni talab qiladigan imtihonlarga tayyorlanayotganlar.',
          },
          {
            skills: [
              'Birlik iqtisodiyoti va zararsizlik nuqtasini hisoblash',
              'Kapitalni raqobatdosh loyihalar o‘rtasida taqsimlash',
              'Miqyoslanadigan operatsion tizimlarni loyihalash',
              'Moliyaviy modellarni strategiyaga aylantirish',
            ],
            profile: 'Har bir strategik qaror ortida raqamlar bo‘lishini istagan asoschilar, menejerlar va biznes talabalari.',
          },
        ],
      },
      credential: {
        heading: 'Serverda tasdiqlanadigan sertifikatlar',
        body: 'Yo‘nalishni tugatib, noyob ID va tekshiruv xeshiga ega sertifikat oling. Uni istalgan kishi serverda tasdiqlay oladi — PDF faylga ko‘r-ko‘rona ishonish shart emas.',
        tabsLabel: 'Namuna sertifikat',
        specimen: 'NAMUNA',
        certTitle: 'Tamomlanganlik sertifikati',
        trackNames: ['Iqtisodiyot yo‘nalishi', 'Matematika yo‘nalishi', 'Biznes yo‘nalishi'],
        recipientLabel: 'Egasi',
        recipient: 'Namuna o‘quvchi',
        issuedLabel: 'Berilgan sana',
        scoreLabel: 'Yakuniy ball',
        idLabel: 'Sertifikat ID',
        hashLabel: 'Tekshiruv xeshi',
        status: ['Tekshirishga tayyor', 'Tekshirilmoqda…', 'Serverda tasdiqlangan'],
        steps: [
          'Sertifikat ID serverda topildi',
          'O‘quvchi va yo‘nalish ma’lumotlari yozuvga mos',
          'Holati: amalda, bekor qilinmagan',
        ],
        run: 'Tekshiruvni boshlash',
        rerun: 'Qayta tekshirish',
        note: 'Namuna: bu tekshiruv brauzeringizda simulyatsiya qilinadi. Haqiqiy sertifikatlar server tomonidan jonli tekshiriladi.',
        verifyReal: 'Haqiqiy sertifikatni tekshirish',
      },
    },
    meta: {
      title: 'ECONOVA — Iqtisodiyot, matematika va biznes uchun ikki tilli akademik platforma',
      description:
        'Iqtisodiyot, matematika va biznesni yagona ikki tilli (o‘zbek / ingliz) platformada o‘rganing — tizimli yo‘nalishlar, oflayn sinxronlash va serverda tasdiqlangan sertifikatlar.',
    },
    a11y: { primaryNav: 'Asosiy navigatsiya', footerNav: 'Sahifa osti navigatsiyasi', language: 'Til' },
    nav: {
      tracks: 'Yo‘nalishlar',
      architecture: 'Arxitektura',
      start: 'Boshlash',
      signIn: 'Hisobga kirish',
      launch: 'Ilovani ochish',
      dashboard: 'Boshqaruv paneli',
    },
    hero: {
      badge: '[ IKKI TILLI AKADEMIK TIZIM :: O‘Z / EN ]',
      lines: [
        ['Tizimli ', 'tafakkur.'],
        ['Miqyosli ', 'modellar.'],
      ],
      body: 'Iqtisodiyot, matematika va biznesni yagona ikki tilli tizimda o‘zlashtiring — har bir dars, sillabus va sertifikat serverda tekshiriladi.',
      cta: 'Platformaga o‘tish',
      continue: 'O‘qishni davom ettirish',
      explore: 'Yo‘nalishlar',
      proof: ['3 asosiy yo‘nalish', 'O‘Z / EN', 'Tasdiqlangan sertifikatlar'],
    },
    tracks: { badge: '[ ASOSIY FANLAR ]', headline: 'Uch yo‘nalish. Yagona tizim.', explore: 'Yo‘nalishni ko‘rish' },
    chapters: [
      {
        tag: 'IQTISODIYOT',
        headline: 'Bozorlar — tirik tizimlar sifatida.',
        body: 'Makro tsikllardan strategik o‘yinlargacha: rag‘batlar qanday muvozanatga kelishini va uni aynan nima buzishini o‘rganing.',
        topics: ['Makroiqtisodiyot', 'O‘yinlar nazariyasi', 'Bozor muvozanati'],
      },
      {
        tag: 'MATEMATIKA',
        headline: 'Har bir qaror ostidagi tuzilma.',
        body: 'Vektorlar, ehtimollik va modellar — noaniqlik hisoblanadigan narsaga aylanguniga qadar birinchi tamoyillardan quriladi.',
        topics: ['Chiziqli algebra', 'Ehtimollik', 'Miqdoriy modellashtirish'],
      },
      {
        tag: 'BIZNES',
        headline: 'Faqat jozibali emas, miqyoslanadigan strategiya.',
        body: 'Birlik iqtisodidan kapital taqsimotigacha: o‘sib boruvchi kompaniyalar ortidagi hisob-kitob, murosalar va tizim dizayni.',
        topics: ['Birlik iqtisodi', 'Kapital taqsimoti', 'Strategik tizimlar'],
      },
    ],
    architecture: {
      badge: '[ PLATFORMA ARXITEKTURASI ]',
      headline: 'Infratuzilma kabi qurilgan.',
      body: 'Boshqaruv panelini harakatlantiruvchi aynan shu tizim — tezkor, ikki tilli, barqaror va tekshiriladigan.',
      items: [
        {
          title: '⌘K tezkor buyruqlar paneli',
          module: 'NAVIGATSIYA',
          body: 'Har bir kurs, dars va test bo‘ylab klaviatura orqali tezkor navigatsiya.',
        },
        {
          title: 'Ikki tilli nashr (O‘Z / EN)',
          module: 'KONTENT',
          body: 'O‘zbek va ingliz tillaridagi akademik nashrlar yonma-yon chop etiladi va sinxron saqlanadi.',
        },
        {
          title: 'Oflayn ma’lumotlarni sinxronlash (Sync HUD)',
          module: 'SINXRONLASH',
          body: 'Mahalliy saqlash — tarmoq qaytishi bilan ma’lumotlar toza uyg‘unlashadi, holat HUD’da ko‘rinadi.',
        },
        {
          title: 'Serverda tasdiqlangan PDF sertifikatlar',
          module: 'SERTIFIKAT',
          body: 'Chop etishga tayyor sillabuslar va haqiqiyligi serverda tekshiriladigan sertifikatlar.',
        },
      ],
    },
    closing: {
      badge: '[ BOSHLASH ]',
      headline: 'Tizimli fikrlashga tayyormisiz?',
      body: 'Hisob yarating va birinchi yo‘nalishni bir necha soniyada boshlang.',
      cta: 'Hisob yaratish',
      signIn: 'Hisobga kirish',
      continueBody: 'To‘xtagan joyingizdan davom eting yoki yangi yo‘nalishni oching.',
      continue: 'O‘qishni davom ettirish',
      browse: 'Kurslarni ko‘rish',
    },
    footer: {
      tagline: 'Iqtisodiyot, matematika va biznes uchun ikki tilli akademik tizim.',
      status: '[ TIZIM :: ONLAYN · O‘Z / EN ]',
      language: 'Til',
      columns: [
        {
          title: 'Yo‘nalishlar',
          links: [
            { label: 'Iqtisodiyot', action: 'econ' },
            { label: 'Matematika', action: 'math' },
            { label: 'Biznes', action: 'biz' },
          ],
        },
        {
          title: 'Platforma',
          links: [
            { label: 'Umumiy ko‘rinish', action: 'overview' },
            { label: 'Arxitektura', action: 'architecture' },
            { label: 'Hisobga kirish', action: 'signin' },
            { label: 'Buyruqlar paneli', action: 'command' },
          ],
        },
        {
          title: 'Hamjamiyat',
          links: [
            { label: 'Hamjamiyat markazi', action: 'community' },
            { label: 'GitHub', action: 'github' },
            { label: 'Tasdiqlangan sertifikatlar', action: 'certificates' },
          ],
        },
      ],
      legal: 'Tizimli akademik platforma',
      backToTop: 'Yuqoriga',
    },
    rail: { label: 'Bo‘limlar', items: ['Kirish', 'Iqtisodiyot', 'Matematika', 'Biznes', 'Arxitektura', 'Boshlash'] },
  },
};

/** Discipline taxonomy — strict 1-to-1 with /overview, in chapter order. */
const CHAPTER_ACCENTS = ['#5DE1D2', '#9274FF', '#6FE0A1'] as const;

/** Architecture tiles: icon + accent per index. */
const CAPABILITY_META: ReadonlyArray<{ icon: LucideIcon; accent: string }> = [
  { icon: Command, accent: '#9274FF' },
  { icon: Languages, accent: '#5DE1D2' },
  { icon: RefreshCw, accent: '#6FE0A1' },
  { icon: FileCheck2, accent: '#F5B942' },
];

const GITHUB_URL = 'https://github.com/temurbek2310/Ecanova';

/** Footer track links light a discipline-coloured dot on hover. */
const FOOTER_ACCENTS: Partial<Record<FooterAction, string>> = {
  econ: '#5DE1D2',
  math: '#9274FF',
  biz: '#6FE0A1',
};

/** Scroll targets for the chapter rail (00–05) and the accent each lights up with. */
const RAIL_TARGETS = ['top', 'track-economics', 'track-mathematics', 'track-business', 'architecture', 'get-started'] as const;
const RAIL_ACCENTS = ['#5DE1D2', '#5DE1D2', '#9274FF', '#6FE0A1', '#F5B942', '#5DE1D2'] as const;
const TRACK_IDS = ['track-economics', 'track-mathematics', 'track-business'] as const;

/* ------------------------------------------------------------------ */
/* App routes                                                          */
/* ------------------------------------------------------------------ */

/** Real app paths (see src/lib/auth-routing.ts → parseRouteFromLocation). */
const ROUTES = {
  overview: '/overview',
  catalog: '/catalog',
  register: '/register?redirectTo=%2Foverview',
  course: (id: string) => `/course/${encodeURIComponent(id)}`,
} as const;

/** Card / sandbox order → catalog subject. */
const TRACK_KEYS: readonly SandboxTrack[] = ['econ', 'math', 'biz'];
const TRACK_SUBJECT: Record<SandboxTrack, Subject> = { econ: 'Economics', math: 'Mathematics', biz: 'Business' };
/**
 * Entry course per track until /api/catalog answers (or if it fails): the database seed's courses
 * (server/seed.ts). The live catalog then picks the most introductory course with this locale's edition.
 */
const FALLBACK_COURSE: Record<SandboxTrack, string> = {
  econ: 'course-econ-beg',
  math: 'course-math-int',
  biz: 'course-biz-adv',
};
const LEVEL_ORDER: readonly CourseLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

function pickEntryCourse(courses: CourseCatalogItem[], subject: Subject, locale: LocaleCode): string | null {
  const rank = (c: CourseCatalogItem) =>
    (c.editions?.[locale] ? 0 : 10) + Math.max(0, LEVEL_ORDER.indexOf(c.level));
  let best: CourseCatalogItem | null = null;
  for (const c of courses) {
    if (c.subject !== subject) continue;
    if (!best || rank(c) < rank(best)) best = c; // stable: catalog order breaks ties
  }
  return best?.id ?? null;
}

/** Height of the sticky navbar — anchor scrolls stop below it. */
const NAV_OFFSET = 64;

/* ------------------------------------------------------------------ */
/* Shared presentational pieces                                        */
/* ------------------------------------------------------------------ */

/**
 * Section container on a 1400px track. Horizontal padding lives in landing.css: `.lp-gutter` is the
 * stepped cadence shared with the navbar (20 · 24 · 32 · 40 · 48px), `.lp-gutter--rail` adds right
 * clearance from the fixed 00–05 chapter rail while it is shown.
 */
const GUTTER = 'lp-gutter lp-gutter--rail relative z-10 mx-auto w-full max-w-[1400px]';

type AnchorLikeProps = {
  href?: string;
  onClick?: (e: ReactMouseEvent<HTMLElement>) => void;
};

interface ButtonProps extends AnchorLikeProps {
  children: ReactNode;
  variant?: 'primary' | 'violet' | 'glass';
  size?: 'md' | 'sm';
  arrow?: boolean;
}

/** Neobrutalist control: solid hard-shadow primary or frosted-glass secondary. */
function BrutalButton({ children, variant = 'primary', size = 'md', arrow, href, onClick }: ButtonProps) {
  const className = `lp-btn lp-btn--${variant}${size === 'sm' ? ' lp-btn--sm' : ''}`;
  const inner = (
    <>
      <span>{children}</span>
      {arrow && <ArrowUpRight aria-hidden="true" className="lp-btn__icon" strokeWidth={2.5} />}
    </>
  );
  if (href) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <p className="lp-badge" style={tone ? ({ '--lp-accent': tone } as CSSProperties) : undefined}>
      {children}
    </p>
  );
}

const LOCALES: readonly LocaleCode[] = ['en', 'uz'];

/**
 * Layout-shift-free bilingual text. Both editions are rendered into the same grid cell, so the box is
 * always sized to the longer one and toggling O‘Z / EN never reflows the page. Only the active
 * edition is visible; the other is `visibility: hidden` + `aria-hidden` (skipped by screen readers,
 * find-in-page and selection). Each edition carries its own `lang` for correct hyphenation / speech.
 */
function Bi({
  locale,
  pick,
  block,
}: {
  locale: LocaleCode;
  pick: (copy: LandingCopy) => ReactNode;
  /** Block-level grid (fills the line) instead of an inline-grid. */
  block?: boolean;
}) {
  return (
    <span className={block ? 'lp-bi lp-bi--block' : 'lp-bi'}>
      {LOCALES.map((l) => (
        <span key={l} lang={l} className="lp-bi__ed" aria-hidden={l === locale ? undefined : true}>
          {pick(COPY[l])}
        </span>
      ))}
    </span>
  );
}

function LocaleSwitch({
  locale,
  label,
  onChange,
}: {
  locale: LocaleCode;
  label: string;
  onChange: (next: LocaleCode) => void;
}) {
  return (
    <div role="group" aria-label={label} className="lp-locale">
      <button type="button" lang="en" aria-pressed={locale === 'en'} onClick={() => onChange('en')}>
        EN
      </button>
      <button type="button" lang="uz" aria-pressed={locale === 'uz'} onClick={() => onChange('uz')}>
        O‘Z
      </button>
    </div>
  );
}

/** Same shift-free stacking as <Bi>, for UI states: every item reserves space, only `active` shows. */
function Swap({ active, items, block }: { active: number; items: ReactNode[]; block?: boolean }) {
  return (
    <span className={block ? 'lp-bi lp-bi--block' : 'lp-bi'}>
      {items.map((node, i) => (
        <span key={i} className="lp-bi__ed" aria-hidden={i === active ? undefined : true}>
          {node}
        </span>
      ))}
    </span>
  );
}

/** Bilingual list: both editions' <ul>s share one grid cell, so wrapping differences never shift layout. */
function BiList({
  locale,
  pick,
  className,
  item,
}: {
  locale: LocaleCode;
  pick: (copy: LandingCopy) => readonly string[];
  className?: string;
  item: (text: string) => ReactNode;
}) {
  return (
    <div className="lp-bi lp-bi--block">
      {LOCALES.map((l) => (
        <ul key={l} lang={l} aria-hidden={l === locale ? undefined : true} className={`lp-bi__ed ${className ?? ''}`}>
          {pick(COPY[l]).map((text) => (
            <li key={text}>{item(text)}</li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/**
 * Illustrative specimen data — clearly labelled SPECIMEN / NAMUNA in the UI, never a real learner.
 * Format mirrors a real credential: track-coded ID + truncated verification hash.
 */
const CREDENTIAL_SPECIMENS = [
  { id: 'ECN-ECO-26-7F3A21', hash: '9f2c41b7…e41a0d3c', score: 94, issued: '2026-09-14' },
  { id: 'ECN-MAT-26-B41C09', hash: '3ad8e05f…71c2b9e4', score: 91, issued: '2026-10-02' },
  { id: 'ECN-BIZ-26-52E8D4', hash: 'c07b9a12…4f6e8a51', score: 96, issued: '2026-10-21' },
] as const;
const VERIFY_STEP_MS = 450;

/**
 * Server-verified credential specimen: switch between the three sample track credentials and replay
 * the verification checklist in place (simulated client-side and labelled as such; the real check
 * lives at /certificates, linked below).
 */
function CredentialSpecimen({ locale, verifyRealProps }: { locale: LocaleCode; verifyRealProps: AnchorLikeProps }) {
  const [track, setTrack] = useState(0);
  /** 0 idle · 1–3 checking step n · 4 verified. */
  const [step, setStep] = useState(0);
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const run = () => {
    clearTimers();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(4);
      return;
    }
    setStep(1);
    [2, 3, 4].forEach((s, i) => {
      timers.current.push(window.setTimeout(() => setStep(s), VERIFY_STEP_MS * (i + 1)));
    });
  };
  const selectTrack = (i: number) => {
    clearTimers();
    setTrack(i);
    setStep(0);
  };

  const status = step === 0 ? 0 : step < 4 ? 1 : 2;
  const spec = CREDENTIAL_SPECIMENS[track];
  const accent = CHAPTER_ACCENTS[track];
  const copy = COPY[locale].trust.credential;

  return (
    <div className="lp-cred" style={{ '--lp-accent': accent } as CSSProperties}>
      <div className="lp-cred__intro">
        <h3 className="lp-heading">
          <Bi locale={locale} block pick={(c) => c.trust.credential.heading} />
        </h3>
        <p className="lp-body mt-4">
          <Bi locale={locale} block pick={(c) => c.trust.credential.body} />
        </p>

        <div role="group" aria-label={copy.tabsLabel} className="lp-cred__tabs">
          {CHAPTER_ACCENTS.map((tone, i) => (
            <button
              key={tone}
              type="button"
              aria-pressed={i === track}
              onClick={() => selectTrack(i)}
              className="lp-cred__tab"
              style={{ '--lp-accent': tone } as CSSProperties}
            >
              <Bi locale={locale} pick={(c) => c.rail.items[i + 1]} />
            </button>
          ))}
        </div>

        <ol className="lp-cred__steps" aria-live="polite">
          {[0, 1, 2].map((i) => {
            const state = step > i + 1 || step === 4 ? 'done' : step === i + 1 ? 'running' : 'pending';
            return (
              <li key={i} data-state={state}>
                <span aria-hidden="true" className="lp-cred__step-icon">
                  {state === 'done' ? '✓' : ''}
                </span>
                <Bi locale={locale} block pick={(c) => c.trust.credential.steps[i]} />
              </li>
            );
          })}
        </ol>

        <div className="lp-cred__actions">
          <button type="button" onClick={run} disabled={status === 1} className="lp-btn lp-btn--primary">
            <span>
              <Swap
                active={step === 4 ? 1 : 0}
                items={[
                  <Bi key="run" locale={locale} pick={(c) => c.trust.credential.run} />,
                  <Bi key="rerun" locale={locale} pick={(c) => c.trust.credential.rerun} />,
                ]}
              />
            </span>
          </button>
          <a {...verifyRealProps} className="lp-btn lp-btn--glass">
            <span>
              <Bi locale={locale} pick={(c) => c.trust.credential.verifyReal} />
            </span>
            <ArrowUpRight aria-hidden="true" className="lp-btn__icon" strokeWidth={2.5} />
          </a>
        </div>
        <p className="lp-cred__note">
          <Bi locale={locale} block pick={(c) => c.trust.credential.note} />
        </p>
      </div>

      {/* The specimen itself */}
      <article className="lp-panel lp-cred__card" data-status={status} aria-label={`${copy.certTitle} — ${copy.trackNames[track]} (${copy.specimen})`}>
        <span aria-hidden="true" className="lp-track__strip" />
        <div className="lp-cred__top">
          <span className="lp-logo" aria-hidden="true">
            <span className="lp-logo__mark">
              <EconovaMark />
            </span>
            ECONOVA
          </span>
          <span className="lp-cred__specimen">
            <Bi locale={locale} pick={(c) => c.trust.credential.specimen} />
          </span>
        </div>

        <p className="lp-index mt-8">
          <Bi locale={locale} pick={(c) => c.trust.credential.certTitle} />
        </p>
        <p className="lp-cred__track">
          <Swap
            active={track}
            block
            items={[0, 1, 2].map((i) => (
              <Bi key={i} locale={locale} block pick={(c) => c.trust.credential.trackNames[i]} />
            ))}
          />
        </p>

        <dl className="lp-cred__meta">
          <div>
            <dt>
              <Bi locale={locale} pick={(c) => c.trust.credential.recipientLabel} />
            </dt>
            <dd>
              <Bi locale={locale} pick={(c) => c.trust.credential.recipient} />
            </dd>
          </div>
          <div>
            <dt>
              <Bi locale={locale} pick={(c) => c.trust.credential.issuedLabel} />
            </dt>
            <dd className="lp-cred__mono">{spec.issued}</dd>
          </div>
          <div>
            <dt>
              <Bi locale={locale} pick={(c) => c.trust.credential.scoreLabel} />
            </dt>
            <dd className="lp-cred__mono">{spec.score}%</dd>
          </div>
          <div>
            <dt>
              <Bi locale={locale} pick={(c) => c.trust.credential.idLabel} />
            </dt>
            <dd className="lp-cred__mono">{spec.id}</dd>
          </div>
        </dl>

        <div className="lp-cred__hash">
          <span>
            <Bi locale={locale} pick={(c) => c.trust.credential.hashLabel} />
          </span>
          <code>{spec.hash}</code>
        </div>

        <div className="lp-cred__seal" data-status={status} role="status">
          <span aria-hidden="true" className="lp-cred__seal-icon">
            <FileCheck2 size={18} strokeWidth={2.25} />
          </span>
          <Swap
            active={status}
            items={[0, 1, 2].map((i) => (
              <Bi key={i} locale={locale} pick={(c) => c.trust.credential.status[i]} />
            ))}
          />
        </div>
      </article>
    </div>
  );
}

function EconovaMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.5 22 20.5H2L12 2.5ZM12 9.5 16.4 17.5H7.6L12 9.5Z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

function Logo({ onClick, compact }: { onClick?: (e: ReactMouseEvent<HTMLElement>) => void; compact?: boolean }) {
  return (
    <a href="/" onClick={onClick} className="lp-logo" aria-label="ECONOVA">
      <span className="lp-logo__mark">
        <EconovaMark />
      </span>
      {/* Compact (navbar): wordmark drops on phones so the right-hand controls fit. */}
      <span aria-hidden="true" className={compact ? 'hidden sm:inline' : undefined}>
        ECONOVA
      </span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Scroll → constellation progress                                     */
/* ------------------------------------------------------------------ */

type ProgressKey = readonly [scrollY: number, progress: number];

/** Piecewise-linear scrollY → constellation progress (0..1). Keys must be strictly increasing in scrollY. */
function mapScrollToProgress(keys: ReadonlyArray<ProgressKey>, y: number): number {
  if (keys.length === 0) return 0;
  if (y <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [y1, p1] = keys[i];
    if (y <= y1) {
      const [y0, p0] = keys[i - 1];
      return p0 + ((y - y0) / (y1 - y0)) * (p1 - p0);
    }
  }
  return keys[keys.length - 1][1];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage({
  locale,
  onToggleLocale,
  onEnterApp,
  onSignIn,
  isAuthenticated,
}: LandingPageProps) {
  const copy = COPY[locale];
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);
  // One shared entrance clock per landing mount (canvas shapes → navbar → hero).
  const [entrance] = useState(createLandingEntrance);

  // Persist through the app's shared i18n helper (`econova_locale` in localStorage + cookie), so the
  // landing and the dashboard always agree and a reload restores the choice via resolveInitialLocale.
  const setLocale = useCallback(
    (next: LocaleCode) => {
      if (next === locale) return;
      persistLocalePreference(next);
      onToggleLocale(next);
    },
    [locale, onToggleLocale],
  );

  // Document metadata. Deferred one microtask: App's own locale effect (which writes the dashboard
  // title) runs after this child effect in the same commit, so the landing values must land last.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const { title, description } = COPY[locale].meta;
      document.documentElement.lang = locale;
      document.title = title;
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Leaving the landing (e.g. → /overview): hand the head back to the app's own metadata.
  const localeRef = useRef(locale);
  localeRef.current = locale;
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const originalDescription = meta?.content ?? '';
    return () => {
      applyDocumentLocale(localeRef.current);
      const current = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (current) current.content = originalDescription;
    };
  }, []);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const lenis = getActiveLenisInstance();
    if (lenis) {
      lenis.scrollTo(el, { offset: -NAV_OFFSET, duration: 1.4 });
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET);
    window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }, []);

  const anchorProps = (id: string) => ({
    href: `#${id}`,
    onClick: (e: ReactMouseEvent<HTMLElement>) => {
      e.preventDefault();
      scrollToId(id);
    },
  });

  /** Let the browser handle new-tab / new-window clicks (⌘/Ctrl/Shift/middle-click) natively. */
  const isPlainClick = (e: ReactMouseEvent<HTMLElement>) =>
    e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

  const enterProps = {
    href: ROUTES.overview,
    onClick: (e: ReactMouseEvent<HTMLElement>) => {
      if (!isPlainClick(e)) return;
      e.preventDefault();
      getActiveLenisInstance()?.scrollTo(0, { immediate: true });
      window.scrollTo(0, 0);
      onEnterApp();
    },
  };

  const signInProps = {
    href: '/login?redirectTo=%2Foverview',
    onClick: (e: ReactMouseEvent<HTMLElement>) => {
      if (!isPlainClick(e)) return;
      e.preventDefault();
      getActiveLenisInstance()?.scrollTo(0, { immediate: true });
      window.scrollTo(0, 0);
      onSignIn('/overview');
    },
  };

  /*
   * In-app navigation to any real route without a full reload: push the path, then fire the same
   * `popstate` App already handles for Back/Forward (it re-parses the URL, switches tab and opens
   * /course/:id). Scroll is reset first so the app surface doesn't inherit the landing's offset.
   */
  const routeProps = (path: string) => ({
    href: path,
    onClick: (e: ReactMouseEvent<HTMLElement>) => {
      if (!isPlainClick(e)) return;
      e.preventDefault();
      getActiveLenisInstance()?.scrollTo(0, { immediate: true });
      window.scrollTo(0, 0);
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
  });

  // Signed-in visitors get "Dashboard / Continue learning" instead of the sign-up funnel.
  // Combines the parent's live `isAuthenticated` state with cached storage synchronization.
  const [cachedUser, setCachedUser] = useState(() => Boolean(getCachedUserSummary()));
  useEffect(() => {
    const sync = () => setCachedUser(Boolean(getCachedUserSummary()));
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const signedIn = typeof isAuthenticated === 'boolean' ? isAuthenticated : cachedUser;

  // Each track's real entry course, resolved from the live catalog (falls back to the seed IDs).
  const [catalog, setCatalog] = useState<CourseCatalogItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    apiFetch('/api/catalog')
      .then((res) => (res.ok ? (res.json() as Promise<{ courses?: CourseCatalogItem[] }>) : null))
      .then((data) => {
        if (alive && data?.courses?.length) setCatalog(data.courses);
      })
      .catch(() => {
        /* offline / API down: keep the seed fallbacks */
      });
    return () => {
      alive = false;
    };
  }, []);
  const trackCourse = useMemo(() => {
    const out = { ...FALLBACK_COURSE };
    if (catalog) {
      for (const key of TRACK_KEYS) out[key] = pickEntryCourse(catalog, TRACK_SUBJECT[key], locale) ?? out[key];
    }
    return out;
  }, [catalog, locale]);
  const trackLink = useCallback(
    (track: SandboxTrack) => routeProps(ROUTES.course(trackCourse[track])),
    // routeProps is a pure factory over stable globals
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackCourse],
  );

  /**
   * Syllabus transparency, computed from the live catalog (never hard-coded): per track, the number of
   * published courses, total lessons and study hours in this locale's edition, and the level span.
   * `null` until the catalog answers, rendered as an em dash in a fixed-width slot (no layout shift).
   */
  const trackStats = useMemo(
    () =>
      TRACK_KEYS.map((key) => {
        if (!catalog) return null;
        const list = catalog.filter((c) => c.subject === TRACK_SUBJECT[key]);
        if (!list.length) return null;
        let lessons = 0;
        let minutes = 0;
        for (const c of list) {
          const edition = c.editions?.[locale] ?? c.editions?.en ?? null;
          lessons += edition?.lessonCount ?? 0;
          minutes += edition?.estimatedMinutes ?? c.estimatedMinutes ?? 0;
        }
        const levels = LEVEL_ORDER.filter((lv) => list.some((c) => c.level === lv));
        return { courses: list.length, lessons, hours: Math.max(1, Math.round(minutes / 60)), levels };
      }),
    [catalog, locale],
  );

  /**
   * Primary "into the app" action:
   * - Already authenticated: enter the app at /overview.
   * - Unauthenticated: go directly to Sign In / Sign Up with post-auth destination /overview (zero flash of /overview or /catalog).
   */
  const launchProps = signedIn ? enterProps : signInProps;

  /*
   * Scroll choreography. Everything created here lives in useGSAP's context and is reverted
   * (tweens + ScrollTriggers) on unmount, e.g. when navigating to /overview or /login.
   * Only transform / opacity are animated, so every frame stays on the compositor.
   */
  useEconovaGSAP(
    rootRef,
    () => {
      const root = rootRef.current;
      if (!root) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const cleanups: Array<() => void> = [];
      const one = (selector: string, scope: ParentNode = root) => scope.querySelector<HTMLElement>(selector);
      const all = (selector: string, scope: ParentNode = root) =>
        Array.from(scope.querySelectorAll<HTMLElement>(selector));

      /* ---- 1a. Master scrub: scroll position → constellation progress ---- */
      let keys: ProgressKey[] = [[0, 0]];

      const measure = () => {
        const vh = window.innerHeight;
        const maxY = Math.max(1, ScrollTrigger.maxScroll(window));
        const el = (name: string) => root.querySelector<HTMLElement>(`[data-anchor="${name}"]`);
        const top = (node: HTMLElement | null) => (node ? node.getBoundingClientRect().top + window.scrollY : 0);
        const center = (node: HTMLElement | null) => (node ? top(node) + node.offsetHeight / 2 - vh / 2 : 0);

        const arch = el('arch');
        const archH = arch?.offsetHeight ?? vh;
        const raw: ProgressKey[] = [
          [0, 0],
          [top(el('tracks')) - vh * 0.6, 0.22], // gyroscope holds while the hero is on screen
          [center(el('econ')), 0.315], // economics formed
          [center(el('math')), 0.415], // mathematics formed
          [center(el('biz')), 0.515], // business formed
          [top(arch) - vh * 0.5, 0.53], // strata begin to align
          [top(arch) + archH * 0.15, 0.62],
          [top(arch) + archH * 0.75, 0.74],
          [top(el('cta')) - vh * 0.3, 0.84], // halo pulls back
          [maxY, 1],
        ];
        const next: ProgressKey[] = [];
        for (const [y, p] of raw) {
          const prev = next[next.length - 1];
          next.push([prev && y <= prev[0] ? prev[0] + 1 : Math.max(0, y), p]);
        }
        keys = next;
      };
      measure();
      ScrollTrigger.addEventListener('refresh', measure);
      cleanups.push(() => ScrollTrigger.removeEventListener('refresh', measure));

      const proxy = { value: 0 };
      gsap.to(proxy, {
        value: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: reduced ? true : 1.4,
        },
        onUpdate: () => {
          scrollProgressRef.current = mapScrollToProgress(keys, proxy.value * Math.max(1, ScrollTrigger.maxScroll(window)));
        },
      });

      /* ---- 1b. Telemetry bar under the navbar (feedback, not decoration: kept under reduced motion) ---- */
      const bar = one('[data-progress-bar]');
      if (bar) {
        gsap.fromTo(
          bar,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            transformOrigin: 'left center',
            scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: true },
          },
        );
      }

      /* ---- 1c. Active chapter rail: direct class toggles, no React state, no layout reads ---- */
      const railItems = all('[data-rail-item]');
      let activeChapter = -1;
      const setActiveChapter = (index: number) => {
        if (index === activeChapter) return;
        activeChapter = index;
        railItems.forEach((item, i) => {
          const on = i === index;
          item.classList.toggle('is-active', on);
          if (on) item.setAttribute('aria-current', 'true');
          else item.removeAttribute('aria-current');
        });
      };
      setActiveChapter(0);
      all('[data-chapter]').forEach((chapter) => {
        const index = Number(chapter.dataset.chapter);
        if (!Number.isInteger(index)) return;
        ScrollTrigger.create({
          trigger: chapter,
          start: 'top center',
          end: 'bottom center',
          onEnter: () => setActiveChapter(index),
          onEnterBack: () => setActiveChapter(index),
        });
      });

      /* ---- 2–5. Motion, gated by media queries (reduced motion → everything static & fully visible) ---- */
      const mm = gsap.matchMedia();
      mm.add(
        {
          isDesktop: '(min-width: 768px)',
          allowMotion: '(prefers-reduced-motion: no-preference)',
        },
        (mmContext) => {
          const { isDesktop = false, allowMotion = false } = mmContext.conditions ?? {};
          if (!allowMotion) return;

          /* 2a. Hero mount entrance now lives in the once-per-mount entrance timeline below, so a
             breakpoint change (which re-runs this matchMedia block) can never replay it. */

          /* 2b. Hero scroll-out: copy column lifts and dims so the eye moves to the gyroscope. */
          const hero = one('[data-hero]');
          const heroCopy = one('[data-hero-copy]');
          if (hero && heroCopy) {
            gsap.to(heroCopy, {
              y: -70,
              opacity: 0.2,
              ease: 'none',
              scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1 },
            });
          }

          /* 3. Discipline cards: mechanical slide-in, self-drawing strip, pill stagger, suspended parallax. */
          all('[data-track]').forEach((track) => {
            const grid = one('[data-track-grid]', track);
            const parallax = one('[data-track-parallax]', track);
            const reveal = one('[data-track-reveal]', track);
            const strip = one('[data-track-strip]', track);
            const tags = all('[data-track-tag]', track);
            const fromX = isDesktop ? (track.dataset.track === 'right' ? 40 : -40) : 0;

            if (grid && reveal) {
              const tl = gsap.timeline({ scrollTrigger: { trigger: grid, start: 'top 82%', once: true } });
              tl.from(reveal, { x: fromX, y: 50, opacity: 0, duration: 0.85, ease: 'power3.out' }, 0);
              if (strip) {
                tl.from(strip, { scaleX: 0, transformOrigin: 'left center', duration: 0.8, ease: 'power3.inOut' }, 0.15);
              }
              if (tags.length) tl.from(tags, { y: 14, opacity: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' }, 0.4);
            }

            if (parallax) {
              gsap.fromTo(
                parallax,
                { yPercent: 7 },
                {
                  yPercent: -7,
                  ease: 'none',
                  scrollTrigger: { trigger: track, start: 'top bottom', end: 'bottom top', scrub: 1.2 },
                },
              );
            }
          });

          /* 4a. Architecture bento: staggered grid lock. */
          const archGrid = one('[data-arch-grid]');
          const archCards = all('[data-arch-reveal]');
          if (archGrid && archCards.length) {
            gsap.from(archCards, {
              y: 44,
              scale: 0.96,
              opacity: 0,
              duration: 0.7,
              stagger: 0.09,
              ease: 'power3.out',
              scrollTrigger: { trigger: archGrid, start: 'top 80%', once: true },
            });
          }

          /* 4b. Opposing column depth (desktop two-column grid only). */
          if (isDesktop && archGrid) {
            const columnDepth: Array<[string, number, number]> = [
              ['[data-arch-col="0"]', -8, 8],
              ['[data-arch-col="1"]', 18, -18],
            ];
            columnDepth.forEach(([selector, from, to]) => {
              const cells = all(selector, archGrid);
              if (!cells.length) return;
              gsap.fromTo(
                cells,
                { y: from },
                {
                  y: to,
                  ease: 'none',
                  scrollTrigger: { trigger: archGrid, start: 'top bottom', end: 'bottom top', scrub: 1.1 },
                },
              );
            });
          }

          /* 5. Final CTA: scrubbed lock-in as the certificate shield centres behind it. */
          const ctaTrigger = one('[data-cta-trigger]');
          const ctaBox = one('[data-cta-box]');
          if (ctaTrigger && ctaBox) {
            gsap.fromTo(
              ctaBox,
              { scale: 0.93, y: 48, opacity: 0.4 },
              {
                scale: 1,
                y: 0,
                opacity: 1,
                ease: 'none',
                scrollTrigger: { trigger: ctaTrigger, start: 'top 90%', end: 'top 48%', scrub: 1 },
              },
            );
          }

          /* 6. Footer: brand + nav columns rise in once as the closure comes into view. */
          const footer = one('[data-footer]');
          const footerCols = all('[data-footer-col]');
          if (footer && footerCols.length) {
            gsap.from(footerCols, {
              y: 24,
              opacity: 0,
              duration: 0.6,
              stagger: 0.08,
              ease: 'power3.out',
              scrollTrigger: { trigger: footer, start: 'top 92%', once: true },
            });
          }
        },
      );
      cleanups.push(() => mm.revert());

      // Web fonts / locale swaps change page height without a window resize.
      let raf = 0;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => ScrollTrigger.refresh());
      });
      observer.observe(root);
      cleanups.push(() => {
        cancelAnimationFrame(raf);
        observer.disconnect();
      });

      return () => cleanups.forEach((fn) => fn());
    },
    { dependencies: [] },
  );

  /*
   * Mount entrance (plays once per landing mount; see src/lib/landing-entrance.ts for the timeline):
   * shapes assemble on the canvas, then the navbar and its items, then the hero copy. The DOM side
   * is hidden synchronously before first paint and always completes to opacity 1 / no transform:
   * reduced motion and background tabs skip it, a hidden tab mid-entrance jumps to the end, and a
   * wall-clock fail-safe finishes it even if animation frames are throttled. Locale switches and
   * other re-renders never touch these inline styles, so nothing replays or flashes.
   */
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || document.hidden || entrance.startedAt !== null) {
      entrance.skip = entrance.skip || reduced || document.hidden;
      root.dataset.entrance = 'skipped';
      return;
    }
    root.dataset.entrance = 'pending';

    const q = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
    const nav = q('[data-entrance-nav]');
    const navItems = q('[data-nav-group] > *');
    const badge = q('[data-hero-badge]');
    const lines = q('[data-hero-line]');
    const rise = q('[data-hero-rise]');
    const targets = [...nav, ...navItems, ...badge, ...lines, ...rise];
    const T = ENTRANCE_TIMELINE;
    const lift = T.heroLift;

    // Hide synchronously (before first paint). GSAP renders `fromTo` start values lazily on its next
    // tick, which could otherwise let one frame of fully visible copy through before the entrance.
    for (const el of targets) {
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
    }

    const finish = () => {
      gsap.set(targets, { clearProps: 'opacity,visibility,transform' });
      root.dataset.entrance = 'done';
    };
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', lazy: false }, onComplete: finish });
    tl.fromTo(nav, { autoAlpha: 0, y: T.nav.y }, { autoAlpha: 1, y: 0, duration: T.nav.duration, ease: 'power2.out' }, T.nav.at)
      .fromTo(
        navItems,
        { autoAlpha: 0, y: T.navItems.y },
        { autoAlpha: 1, y: 0, duration: T.navItems.duration, stagger: T.navItems.stagger },
        T.navItems.at,
      )
      .fromTo(badge, { autoAlpha: 0, y: lift }, { autoAlpha: 1, y: 0, duration: T.heroBadge.duration }, T.heroBadge.at)
      .fromTo(
        lines,
        { autoAlpha: 0, y: lift },
        { autoAlpha: 1, y: 0, duration: T.heroLines.duration, stagger: T.heroLines.stagger },
        T.heroLines.at,
      )
      .fromTo(
        rise,
        { autoAlpha: 0, y: lift },
        { autoAlpha: 1, y: 0, duration: T.heroRise.duration, stagger: T.heroRise.stagger },
        T.heroRise.at,
      );

    // Join the shared clock at the right offset, whoever (canvas or fallback) starts it.
    const play = (startedAt: number) => {
      const offset = Math.max(0, (performance.now() - startedAt) / 1000);
      root.dataset.entrance = 'playing';
      tl.seek(Math.min(offset, tl.duration()), false).play();
    };
    entrance.onStart.add(play);
    const waitTimer = window.setTimeout(() => entrance.start(), ENTRANCE_CANVAS_WAIT_MS);
    const failSafe = window.setTimeout(
      () => tl.progress(1),
      ENTRANCE_CANVAS_WAIT_MS + ENTRANCE_DOM_END_S * 1000 + 1200,
    );
    const onVisibility = () => {
      if (document.hidden) tl.progress(1);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      entrance.onStart.delete(play);
      window.clearTimeout(waitTimer);
      window.clearTimeout(failSafe);
      document.removeEventListener('visibilitychange', onVisibility);
      tl.kill();
      finish();
    };
    // `entrance` is created once per mount (useState initialiser); the entrance must never re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [econ, math, biz] = copy.chapters;
  const chapters: Array<{ anchor: string; chapter: Chapter; accent: string; right: boolean }> = [
    { anchor: 'econ', chapter: econ, accent: CHAPTER_ACCENTS[0], right: false },
    { anchor: 'math', chapter: math, accent: CHAPTER_ACCENTS[1], right: true },
    { anchor: 'biz', chapter: biz, accent: CHAPTER_ACCENTS[2], right: false },
  ];

  const footerLink = (action: FooterAction) => {
    switch (action) {
      case 'econ':
        return anchorProps(TRACK_IDS[0]);
      case 'math':
        return anchorProps(TRACK_IDS[1]);
      case 'biz':
        return anchorProps(TRACK_IDS[2]);
      case 'architecture':
      case 'certificates':
        return anchorProps('architecture');
      case 'overview':
      case 'command':
        return signedIn ? enterProps : signInProps;
      case 'signin':
        return signInProps;
      case 'github':
        return { href: GITHUB_URL, target: '_blank', rel: 'noopener noreferrer' };
      case 'community':
        return { href: '/community' };
    }
  };

  const toTop = (e: ReactMouseEvent<HTMLElement>) => {
    e.preventDefault();
    scrollToId('top');
  };

  return (
    <div ref={rootRef} lang={locale} className="econova-landing relative min-h-screen overflow-x-clip">
      <Suspense fallback={null}>
        <ConstellationCanvas progressRef={scrollProgressRef} entrance={entrance} />
      </Suspense>

      {/* ---------------- Sticky Glass-Brutalist navbar ---------------- */}
      <header data-entrance-nav className="lp-nav sticky top-0 z-30">
        <nav
          aria-label={copy.a11y.primaryNav}
          className="lp-gutter mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr]"
        >
          <div data-nav-group className="flex items-center">
            <Logo onClick={toTop} compact />
          </div>

          {/* Centre links from lg up: below 1024px the right-hand controls (longest in O‘Z) need the room. */}
          <div data-nav-group className="hidden items-center gap-1 lg:flex">
            <a {...anchorProps('tracks')} className="lp-nav__link inline-flex">
              <Bi locale={locale} pick={(c) => c.nav.tracks} />
            </a>
            <a {...anchorProps('architecture')} className="lp-nav__link inline-flex">
              <Bi locale={locale} pick={(c) => c.nav.architecture} />
            </a>
            <a {...anchorProps('get-started')} className="lp-nav__link inline-flex">
              <Bi locale={locale} pick={(c) => c.nav.start} />
            </a>
          </div>

          <div data-nav-group className="flex items-center justify-end gap-3">
            <LocaleSwitch locale={locale} label={copy.a11y.language} onChange={setLocale} />
            {!signedIn && (
              <a {...signInProps} className="lp-nav__link hidden sm:inline-flex">
                <Bi locale={locale} pick={(c) => c.nav.signIn} />
              </a>
            )}
            <BrutalButton size="sm" arrow {...launchProps}>
              <Bi locale={locale} pick={(c) => (signedIn ? c.nav.dashboard : c.nav.launch)} />
            </BrutalButton>
          </div>
        </nav>
        {/* Scroll telemetry: scrubbed scaleX 0 → 1 across the full page. */}
        <div aria-hidden="true" data-progress-bar className="lp-progress" />
      </header>

      {/* ---------------- Chapter rail (wide desktop only) ---------------- */}
      <nav aria-label={copy.rail.label} className="lp-rail hidden min-[1360px]:flex">
        {copy.rail.items.map((label, i) => (
          <a
            key={RAIL_TARGETS[i]}
            data-rail-item
            {...anchorProps(RAIL_TARGETS[i])}
            aria-label={label}
            className="lp-rail__item"
            style={{ '--lp-accent': RAIL_ACCENTS[i] } as CSSProperties}
          >
            <span aria-hidden="true" className="lp-rail__label">
              {label}
            </span>
            {/* Magnified on hover / focus (right-anchored); the label tooltip stays at 1×. */}
            <span aria-hidden="true" className="lp-rail__mag">
              <span className="lp-rail__tick" />
              <span>{String(i).padStart(2, '0')}</span>
            </span>
          </a>
        ))}
      </nav>

      <main id="top" className="relative z-10">
        {/* ---------------- Hero ---------------- */}
        <section data-hero data-chapter="0" className="relative flex min-h-[calc(100svh-4rem)] items-center py-16 md:py-20">
          {/* Legibility scrim behind the copy column: strongest below 1024px, subtle on wide desktops. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#080B14]/85 via-[#080B14]/45 to-transparent [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)] lg:w-[72%] lg:opacity-70 2xl:w-[62%] 2xl:opacity-45"
          />
          <div className={`${GUTTER} grid gap-12 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]`}>
            {/* Camera-fixed HUD: copy stays locked to the viewport; only the WebGL camera parallaxes.
                Two groups: badge + headline in front, body / CTAs / proof behind. */}
            <div data-hero-copy className="min-w-0">
              <div>
                <div data-hero-badge>
                  <Badge tone="#5DE1D2">
                    <Bi locale={locale} pick={(c) => c.hero.badge} />
                  </Badge>
                </div>

                <h1 className="lp-display mt-7">
                  {[0, 1].map((i) => (
                    <span key={i} className="lp-mask">
                      <span data-hero-line className="block">
                        <Bi
                          locale={locale}
                          block
                          pick={(c) => (
                            <>
                              {c.hero.lines[i][0]}
                              <span style={{ color: i === 0 ? '#9274FF' : '#5DE1D2' }}>{c.hero.lines[i][1]}</span>
                            </>
                          )}
                        />
                      </span>
                    </span>
                  ))}
                </h1>
              </div>

              <div>
                <p data-hero-rise className="lp-lead mt-7 max-w-[540px]">
                  <Bi locale={locale} block pick={(c) => c.hero.body} />
                </p>

                <div data-hero-rise className="mt-9 flex flex-wrap items-center gap-4">
                  <BrutalButton arrow {...launchProps}>
                    <Bi locale={locale} pick={(c) => (signedIn ? c.hero.continue : c.hero.cta)} />
                  </BrutalButton>
                  <BrutalButton variant="glass" {...anchorProps('tracks')}>
                    <Bi locale={locale} pick={(c) => c.hero.explore} />
                  </BrutalButton>
                </div>

                <ul data-hero-rise className="lp-proof mt-10">
                  {[0, 1, 2].map((i) => (
                    <li key={i}>
                      <span aria-hidden="true" className="lp-proof__dot" style={{ backgroundColor: CHAPTER_ACCENTS[i] }} />
                      <Bi locale={locale} pick={(c) => c.hero.proof[i]} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {/* Right column intentionally open: the 3D Orbital Gyroscope sits here. */}
            <div aria-hidden="true" className="hidden md:block" />
          </div>
        </section>

        {/* ---------------- Core disciplines ---------------- */}
        <section id="tracks" data-anchor="tracks" className="scroll-mt-16">
          {chapters.map(({ anchor, accent, right }, i) => (
            <article
              key={anchor}
              id={TRACK_IDS[i]}
              data-anchor={anchor}
              data-chapter={i + 1}
              data-track={right ? 'right' : 'left'}
              /* First article: +4rem top (the navbar height) so its content centres in the visible area
                 below the fixed navbar rather than the full viewport. */
              className={`flex min-h-[88svh] items-center ${i === 0 ? 'pb-16 pt-32 md:pb-20 md:pt-36' : 'py-16 md:py-20'}`}
            >
              <div className="w-full">
              {/* Section header lives inside the Economics article, above its card: the formation
                  settles when this article is centred, so header + card centre together and the
                  heading clears the fixed navbar instead of sitting underneath it. */}
              {i === 0 && (
                <div className={`${GUTTER} mb-10 md:mb-12`}>
                  <div>
                    <Badge tone="#9274FF">
                      <Bi locale={locale} pick={(c) => c.tracks.badge} />
                    </Badge>
                  </div>
                  <h2 className="lp-heading-lg mt-5 max-w-[720px]">
                    <Bi locale={locale} block pick={(c) => c.tracks.headline} />
                  </h2>
                </div>
              )}
              <div data-track-grid className={`${GUTTER} grid md:grid-cols-2 md:gap-16`}>
                {/* The open column belongs to the morphing 3D course icon behind the page.
                    Layers so transforms never collide: parallax (scrub) → reveal (entrance) →
                    panel (CSS hover). */}
                <div data-track-parallax className={`max-w-[600px] ${right ? 'md:col-start-2' : ''}`}>
                  <div data-track-reveal>
                  <div>
                <div className="lp-panel lp-track" style={{ '--lp-accent': accent } as CSSProperties}>
                  <span aria-hidden="true" data-track-strip className="lp-track__strip" />
                  <p className="lp-index">
                    {String(i + 1).padStart(2, '0')} <span className="opacity-50">{'//'}</span>{' '}
                    <Bi locale={locale} pick={(c) => c.chapters[i].tag} />
                  </p>
                  <h3 className="lp-heading mt-5">
                    <Bi locale={locale} block pick={(c) => c.chapters[i].headline} />
                  </h3>
                  <p className="lp-body mt-4">
                    <Bi locale={locale} block pick={(c) => c.chapters[i].body} />
                  </p>
                  {/* Both editions' pill rows share one grid cell (same idea as <Bi>), so a row that wraps
                      in one language doesn't change the card height in the other. */}
                  <div className="lp-bi lp-bi--block mt-7">
                    {LOCALES.map((l) => (
                      <ul
                        key={l}
                        lang={l}
                        aria-hidden={l === locale ? undefined : true}
                        className="lp-bi__ed flex flex-wrap gap-2.5"
                      >
                        {COPY[l].chapters[i].topics.map((topic) => (
                          <li key={topic} data-track-tag className="lp-tag">
                            {topic}
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                  <div className="mt-9">
                    <BrutalButton variant="glass" arrow {...trackLink(TRACK_KEYS[i])}>
                      <Bi locale={locale} pick={(c) => c.tracks.explore} />
                    </BrutalButton>
                  </div>
                </div>
                  </div>
                  </div>
                </div>
              </div>
              </div>
            </article>
          ))}
        </section>

        {/* ---------------- Platform architecture bento ---------------- */}
        {/* ---------------- Live Engine Sandbox (try a lesson before signing up) ---------------- */}
        <section id="sandbox" aria-labelledby="sandbox-title" className="scroll-mt-16 py-20 md:py-28">
          <div className={GUTTER}>
            <EngineSandbox locale={locale} trackLink={trackLink} />
          </div>
        </section>

        <section id="architecture" data-anchor="arch" data-chapter="4" className="py-24 md:py-32">
          <div className={GUTTER}>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div>
                  <Badge tone="#F5B942">
                    <Bi locale={locale} pick={(c) => c.architecture.badge} />
                  </Badge>
                </div>
                <h2 className="lp-heading-lg mt-5 max-w-[720px]">
                  <Bi locale={locale} block pick={(c) => c.architecture.headline} />
                </h2>
              </div>
              <p className="lp-body max-w-[420px]">
                <Bi locale={locale} block pick={(c) => c.architecture.body} />
              </p>
            </div>

            <ol data-arch-grid className="mt-14 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-2">
              {CAPABILITY_META.map((_, i) => {
                const { icon: Icon, accent } = CAPABILITY_META[i];
                return (
                  /* <li> carries the column scroll parallax, the inner panel the entrance reveal. */
                  <li key={i} data-arch-col={i % 2}>
                  <div className="h-full">
                  <div
                    data-arch-reveal
                    className="lp-panel lp-panel--md lp-tile h-full"
                    style={{ '--lp-accent': accent } as CSSProperties}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="lp-tile__icon">
                        <Icon aria-hidden="true" size={22} strokeWidth={2.25} />
                      </span>
                      <span className="lp-index lp-index--muted">
                        {String(i + 1).padStart(2, '0')} ::{' '}
                        <Bi locale={locale} pick={(c) => c.architecture.items[i].module} />
                      </span>
                    </div>
                    <div className="mt-10">
                      <h3 className="lp-tile__title">
                        <Bi locale={locale} block pick={(c) => c.architecture.items[i].title} />
                      </h3>
                      <p className="lp-body mt-3">
                        <Bi locale={locale} block pick={(c) => c.architecture.items[i].body} />
                      </p>
                    </div>
                  </div>
                  </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ---------------- Trust & transparency: syllabus + credential specimen ---------------- */}
        <section id="trust" aria-labelledby="trust-title" className="scroll-mt-16 py-20 md:py-28">
          <div className={GUTTER}>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <Badge tone="#6FE0A1">
                  <Bi locale={locale} pick={(c) => c.trust.badge} />
                </Badge>
                <h2 id="trust-title" className="lp-heading-lg mt-5 max-w-[760px]">
                  <Bi locale={locale} block pick={(c) => c.trust.headline} />
                </h2>
              </div>
              <p className="lp-body max-w-[420px]">
                <Bi locale={locale} block pick={(c) => c.trust.body} />
              </p>
            </div>

            {/* Transparent syllabus, one card per track */}
            <ul className="lp-syl-grid mt-12 md:mt-14">
              {TRACK_KEYS.map((key, i) => {
                const stats = trackStats[i];
                const values: Array<(c: LandingCopy) => string> = [
                  () => (stats ? String(stats.courses) : '—'),
                  () => (stats ? String(stats.lessons) : '—'),
                  (c) => (stats ? `≈ ${stats.hours} ${c.trust.syllabus.hoursUnit}` : '—'),
                ];
                return (
                  <li key={key} className="lp-panel lp-panel--md lp-syl" style={{ '--lp-accent': CHAPTER_ACCENTS[i] } as CSSProperties}>
                    <span aria-hidden="true" className="lp-track__strip" />
                    <p className="lp-index">
                      {String(i + 1).padStart(2, '0')} <span className="opacity-50">{'//'}</span>{' '}
                      <Bi locale={locale} pick={(c) => c.chapters[i].tag} />
                    </p>

                    <dl className="lp-syl__stats">
                      {values.map((value, s) => (
                        <div key={s} className="lp-syl__stat">
                          <dt>
                            <Bi locale={locale} pick={(c) => c.trust.syllabus.stats[s]} />
                          </dt>
                          <dd>
                            <Bi locale={locale} pick={value} />
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <p className="lp-syl__levels">
                      <Bi
                        locale={locale}
                        pick={(c) =>
                          `${c.trust.syllabus.levels}: ${
                            stats?.levels.length
                              ? stats.levels.map((lv) => c.trust.syllabus.levelNames[lv]).join(' → ')
                              : '—'
                          }`
                        }
                      />
                    </p>

                    <h3 className="lp-syl__title">
                      <Bi locale={locale} pick={(c) => c.trust.syllabus.skillsTitle} />
                    </h3>
                    <BiList
                      locale={locale}
                      className="lp-syl__skills"
                      pick={(c) => c.trust.syllabus.tracks[i].skills}
                      item={(text) => (
                        <>
                          <span aria-hidden="true" className="lp-syl__tick">
                            ✓
                          </span>
                          {text}
                        </>
                      )}
                    />

                    <h3 className="lp-syl__title">
                      <Bi locale={locale} pick={(c) => c.trust.syllabus.profileTitle} />
                    </h3>
                    <p className="lp-body lp-syl__profile">
                      <Bi locale={locale} block pick={(c) => c.trust.syllabus.tracks[i].profile} />
                    </p>

                    <div className="lp-syl__cta">
                      <BrutalButton variant="glass" arrow {...trackLink(key)}>
                        <Bi locale={locale} pick={(c) => c.trust.syllabus.open} />
                      </BrutalButton>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Server-verified credential specimen */}
            <div className="mt-16 md:mt-24">
              <CredentialSpecimen locale={locale} verifyRealProps={routeProps('/certificates')} />
            </div>
          </div>
        </section>

        {/* ---------------- Final CTA ---------------- */}
        <section
          id="get-started"
          data-anchor="cta"
          data-chapter="5"
          className="flex min-h-[80svh] items-center py-24 md:py-32"
        >
          <div data-cta-trigger className={GUTTER}>
            <div data-cta-box className="lp-panel lp-cta">
              <div className="max-w-[760px]">
                <Badge tone="#5DE1D2">
                  <Bi locale={locale} pick={(c) => c.closing.badge} />
                </Badge>
                <h2 className="lp-closing mt-6">
                  <Bi locale={locale} block pick={(c) => c.closing.headline} />
                </h2>
                <p className="lp-lead mt-5 max-w-[520px]">
                  <Bi locale={locale} block pick={(c) => (signedIn ? c.closing.continueBody : c.closing.body)} />
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <BrutalButton arrow {...(signedIn ? enterProps : routeProps(ROUTES.register))}>
                  <Bi locale={locale} pick={(c) => (signedIn ? c.closing.continue : c.closing.cta)} />
                </BrutalButton>
                <BrutalButton variant="glass" {...(signedIn ? routeProps(ROUTES.catalog) : signInProps)}>
                  <Bi locale={locale} pick={(c) => (signedIn ? c.closing.browse : c.closing.signIn)} />
                </BrutalButton>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ---------------- Glass-Brutalist footer: architectural closure ---------------- */}
      <footer
        data-footer
        className="lp-footer relative z-10 border-t-2 border-white/15 bg-[#080B14]/85 backdrop-blur-2xl"
      >
        {/* Three-discipline accent strip, echoing the navbar's scroll telemetry line. */}
        <div aria-hidden="true" className="lp-footer__accent" />

        <div className={`${GUTTER} pt-16 md:pt-20`}>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            {/* Brand column (GSAP rise on the column) */}
            <div data-footer-col className="md:col-span-5">
              <div>
              <Logo onClick={toTop} />
              <p className="lp-body mt-4 max-w-[360px] !text-[15px]">{copy.footer.tagline}</p>
              <p className="lp-footer__status mt-6 border border-white/15 bg-[#101522]/80 px-3 py-1.5 text-xs">
                <span aria-hidden="true" className="lp-pulse" />
                {copy.footer.status}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <span className="lp-footer__title">{copy.footer.language}</span>
                <LocaleSwitch locale={locale} label={copy.a11y.language} onChange={setLocale} />
              </div>
              </div>
            </div>

            {/* Navigation columns */}
            <nav
              aria-label={copy.a11y.footerNav}
              className="grid grid-cols-1 gap-8 min-[400px]:grid-cols-2 sm:grid-cols-3 md:col-span-7"
            >
              {copy.footer.columns.map((column) => (
                <div key={column.title} data-footer-col>
                  <h2 className="lp-footer__title">{column.title}</h2>
                  <ul className="mt-5 flex flex-col gap-3.5">
                    {column.links.map((link) => {
                      const accent = FOOTER_ACCENTS[link.action];
                      const external = link.action === 'github';
                      // Keep the last word glued to the ⌘K hint / arrow so neither wraps onto a line alone.
                      const cut = link.label.lastIndexOf(' ') + 1;
                      return (
                        <li key={link.action}>
                          <a
                            {...footerLink(link.action)}
                            className="lp-footer__link"
                            style={accent ? ({ '--lp-accent': accent } as CSSProperties) : undefined}
                          >
                            {accent && <span aria-hidden="true" className="lp-footer__dot" />}
                            {link.label.slice(0, cut)}
                            <span className="whitespace-nowrap">
                              {link.label.slice(cut)}
                              {link.action === 'command' && <kbd className="lp-footer__kbd">⌘K</kbd>}
                              <span
                                aria-hidden="true"
                                className={`lp-footer__arrow${external ? ' lp-footer__arrow--out' : ''}`}
                              >
                                {external ? '↗' : '→'}
                              </span>
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Full-bleed interactive 3D dotted wordmark (outside the 1280px gutter, edge to edge). */}
        <div
          role="img"
          aria-label="ECONOVA"
          className="my-6 h-[140px] w-full select-none px-2 sm:h-[200px] sm:px-4 md:h-[260px] lg:h-[300px]"
        >
          <FooterWordmarkCanvas />
        </div>

        <div className={`${GUTTER} pb-8`}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
            <p className="lp-index lp-index--muted">
              © {new Date().getFullYear()} ECONOVA · {copy.footer.legal}
            </p>
            <button
              type="button"
              onClick={toTop}
              className="lp-footer__top border-2 border-white/15 bg-[#101522] px-3 py-1.5 text-xs shadow-[3px_3px_0px_#000] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              {copy.footer.backToTop}
              <span aria-hidden="true">↑</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
