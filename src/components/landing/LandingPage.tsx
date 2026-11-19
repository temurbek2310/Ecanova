import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Command, FileCheck2, Languages, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEconovaGSAP } from '@/hooks/useEconovaGSAP';
import { getActiveLenisInstance } from '../../lib/scroll-sync';
import type { LocaleCode } from '../../shared/types';
import { ConstellationCanvas } from './ConstellationCanvas';
import { FooterWordmarkCanvas } from './FooterWordmarkCanvas';
import './landing.css';

gsap.registerPlugin(ScrollTrigger);

export interface LandingPageProps {
  locale: LocaleCode;
  onToggleLocale: (next: LocaleCode) => void;
  /** Navigates to /overview. */
  onEnterApp: () => void;
  /** Navigates to /login. */
  onSignIn: () => void;
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
  nav: { tracks: string; architecture: string; start: string; signIn: string; launch: string };
  hero: {
    badge: string;
    /** Each line: plain lead + accented tail. */
    lines: [[string, string], [string, string]];
    body: string;
    cta: string;
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
  closing: { badge: string; headline: string; body: string; cta: string; signIn: string };
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
}

const COPY: Record<LocaleCode, LandingCopy> = {
  en: {
    nav: { tracks: 'Tracks', architecture: 'Architecture', start: 'Get Started', signIn: 'Sign In', launch: 'Launch App' },
    hero: {
      badge: '[ BILINGUAL ACADEMIC ENGINE :: O‘Z / EN ]',
      lines: [
        ['Systemic ', 'thinking.'],
        ['Scalable ', 'models.'],
      ],
      body: 'Master Economics, Mathematics and Business in one bilingual engine — every lesson, syllabus and credential verified on the server.',
      cta: 'Launch Platform',
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
      body: 'Open the dashboard and start your first track in seconds.',
      cta: 'Enter ECONOVA',
      signIn: 'Sign In',
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
    nav: {
      tracks: 'Yo‘nalishlar',
      architecture: 'Arxitektura',
      start: 'Boshlash',
      signIn: 'Hisobga kirish',
      launch: 'Ilovani ochish',
    },
    hero: {
      badge: '[ IKKI TILLI AKADEMIK TIZIM :: O‘Z / EN ]',
      lines: [
        ['Tizimli ', 'tafakkur.'],
        ['Miqyosli ', 'modellar.'],
      ],
      body: 'Iqtisodiyot, matematika va biznesni yagona ikki tilli tizimda o‘zlashtiring — har bir dars, sillabus va sertifikat serverda tekshiriladi.',
      cta: 'Platformaga o‘tish',
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
        body: 'Birlik iqtisodidan kapital taqsimotigacha: o‘sib boruvchi kompaniyalar ortidagi hisob-kitob, kelishuvlar va tizim dizayni.',
        topics: ['Birlik iqtisodi', 'Kapital taqsimoti', 'Strategik tizimlar'],
      },
    ],
    architecture: {
      badge: '[ PLATFORMA ARXITEKTURASI ]',
      headline: 'Infratuzilma kabi qurilgan.',
      body: 'Boshqaruv panelini harakatlantiruvchi aynan shu tizim — tezkor, ikki tilli, barqaror va tekshiriladigan.',
      items: [
        {
          title: '⌘K Spotlight buyruqlar paneli',
          module: 'NAVIGATSIYA',
          body: 'Har bir kurs, dars va test bo‘ylab klaviatura orqali tezkor navigatsiya.',
        },
        {
          title: 'Ikki nashrli chop etish (O‘Z / EN)',
          module: 'KONTENT',
          body: 'O‘zbek va ingliz tillaridagi akademik nashrlar yonma-yon chop etiladi va sinxron saqlanadi.',
        },
        {
          title: 'Oflayn ma’lumotlar uyg‘unlashuvi (Sync HUD)',
          module: 'SINXRON',
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
      body: 'Boshqaruv panelini oching va birinchi yo‘nalishni bir necha soniyada boshlang.',
      cta: 'ECONOVA’ga kirish',
      signIn: 'Hisobga kirish',
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

function LocaleSwitch({ locale, onChange }: { locale: LocaleCode; onChange: (next: LocaleCode) => void }) {
  return (
    <div role="group" aria-label="Language" className="lp-locale">
      <button type="button" aria-pressed={locale === 'en'} onClick={() => onChange('en')}>
        EN
      </button>
      <button type="button" lang="uz" aria-pressed={locale === 'uz'} onClick={() => onChange('uz')}>
        O‘Z
      </button>
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

export function LandingPage({ locale, onToggleLocale, onEnterApp, onSignIn }: LandingPageProps) {
  const copy = COPY[locale];
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);

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

  const enterProps = {
    href: '/overview',
    onClick: (e: ReactMouseEvent<HTMLElement>) => {
      e.preventDefault();
      onEnterApp();
    },
  };

  const signInProps = {
    href: '/login',
    onClick: (e: ReactMouseEvent<HTMLElement>) => {
      e.preventDefault();
      onSignIn();
    },
  };

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

          /* 2a. Hero mount entrance: masked line snap, then crisp staggered rises. */
          const heroBadge = one('[data-hero-badge]');
          const heroLines = all('[data-hero-line]');
          const heroRise = all('[data-hero-rise]');
          const intro = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.1 });
          if (heroBadge) intro.from(heroBadge, { y: 20, opacity: 0, duration: 0.6 }, 0);
          if (heroLines.length) {
            intro.from(heroLines, { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power4.out' }, 0.08);
          }
          if (heroRise.length) intro.from(heroRise, { y: 20, opacity: 0, duration: 0.6, stagger: 0.08 }, 0.45);

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
        return enterProps;
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
      <ConstellationCanvas progressRef={scrollProgressRef} />

      {/* ---------------- Sticky Glass-Brutalist navbar ---------------- */}
      <header className="lp-nav sticky top-0 z-30">
        <nav
          aria-label="Primary"
          className="lp-gutter mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr]"
        >
          <div className="flex items-center">
            <Logo onClick={toTop} compact />
          </div>

          {/* Centre links from lg up: below 1024px the right-hand controls (longest in O‘Z) need the room. */}
          <div className="hidden items-center gap-1 lg:flex">
            <a {...anchorProps('tracks')} className="lp-nav__link inline-flex">
              {copy.nav.tracks}
            </a>
            <a {...anchorProps('architecture')} className="lp-nav__link inline-flex">
              {copy.nav.architecture}
            </a>
            <a {...anchorProps('get-started')} className="lp-nav__link inline-flex">
              {copy.nav.start}
            </a>
          </div>

          <div className="flex items-center justify-end gap-3">
            <LocaleSwitch locale={locale} onChange={onToggleLocale} />
            <a {...signInProps} className="lp-nav__link hidden sm:inline-flex">
              {copy.nav.signIn}
            </a>
            <BrutalButton size="sm" arrow {...enterProps}>
              {copy.nav.launch}
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
        <section data-hero data-chapter="0" className="relative flex min-h-[calc(100vh-4rem)] items-center py-16 md:py-20">
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
                  <Badge tone="#5DE1D2">{copy.hero.badge}</Badge>
                </div>

                <h1 className="lp-display mt-7">
                  {copy.hero.lines.map(([lead, accent], i) => (
                    <span key={i} className="lp-mask">
                      <span data-hero-line className="block">
                        {lead}
                        <span style={{ color: i === 0 ? '#9274FF' : '#5DE1D2' }}>{accent}</span>
                      </span>
                    </span>
                  ))}
                </h1>
              </div>

              <div>
                <p data-hero-rise className="lp-lead mt-7 max-w-[540px]">
                  {copy.hero.body}
                </p>

                <div data-hero-rise className="mt-9 flex flex-wrap items-center gap-4">
                  <BrutalButton arrow {...enterProps}>
                    {copy.hero.cta}
                  </BrutalButton>
                  <BrutalButton variant="glass" {...anchorProps('tracks')}>
                    {copy.hero.explore}
                  </BrutalButton>
                </div>

                <ul data-hero-rise className="lp-proof mt-10">
                  {copy.hero.proof.map((item, i) => (
                    <li key={i}>
                      <span aria-hidden="true" className="lp-proof__dot" style={{ backgroundColor: CHAPTER_ACCENTS[i] }} />
                      {item}
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
          {chapters.map(({ anchor, chapter, accent, right }, i) => (
            <article
              key={anchor}
              id={TRACK_IDS[i]}
              data-anchor={anchor}
              data-chapter={i + 1}
              data-track={right ? 'right' : 'left'}
              /* First article: +4rem top (the navbar height) so its content centres in the visible area
                 below the fixed navbar rather than the full viewport. */
              className={`flex min-h-[88vh] items-center ${i === 0 ? 'pb-16 pt-32 md:pb-20 md:pt-36' : 'py-16 md:py-20'}`}
            >
              <div className="w-full">
              {/* Section header lives inside the Economics article, above its card: the formation
                  settles when this article is centred, so header + card centre together and the
                  heading clears the fixed navbar instead of sitting underneath it. */}
              {i === 0 && (
                <div className={`${GUTTER} mb-10 md:mb-12`}>
                  <div>
                    <Badge tone="#9274FF">{copy.tracks.badge}</Badge>
                  </div>
                  <h2 className="lp-heading-lg mt-5 max-w-[720px]">
                    {copy.tracks.headline}
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
                    {String(i + 1).padStart(2, '0')} <span className="opacity-50">{'//'}</span> {chapter.tag}
                  </p>
                  <h3 className="lp-heading mt-5">{chapter.headline}</h3>
                  <p className="lp-body mt-4">{chapter.body}</p>
                  <ul className="mt-7 flex flex-wrap gap-2.5">
                    {chapter.topics.map((topic) => (
                      <li key={topic} data-track-tag className="lp-tag">
                        {topic}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-9">
                    <BrutalButton variant="glass" arrow {...enterProps}>
                      {copy.tracks.explore}
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
        <section id="architecture" data-anchor="arch" data-chapter="4" className="py-24 md:py-32">
          <div className={GUTTER}>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div>
                  <Badge tone="#F5B942">{copy.architecture.badge}</Badge>
                </div>
                <h2 className="lp-heading-lg mt-5 max-w-[720px]">
                  {copy.architecture.headline}
                </h2>
              </div>
              <p className="lp-body max-w-[420px]">
                {copy.architecture.body}
              </p>
            </div>

            <ol data-arch-grid className="mt-14 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-2">
              {copy.architecture.items.map((item, i) => {
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
                        {String(i + 1).padStart(2, '0')} :: {item.module}
                      </span>
                    </div>
                    <div className="mt-10">
                      <h3 className="lp-tile__title">{item.title}</h3>
                      <p className="lp-body mt-3">{item.body}</p>
                    </div>
                  </div>
                  </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ---------------- Final CTA ---------------- */}
        <section
          id="get-started"
          data-anchor="cta"
          data-chapter="5"
          className="flex min-h-[80vh] items-center py-24 md:py-32"
        >
          <div data-cta-trigger className={GUTTER}>
            <div data-cta-box className="lp-panel lp-cta">
              <div className="max-w-[760px]">
                <Badge tone="#5DE1D2">{copy.closing.badge}</Badge>
                <h2 className="lp-closing mt-6">{copy.closing.headline}</h2>
                <p className="lp-lead mt-5 max-w-[520px]">{copy.closing.body}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <BrutalButton arrow {...enterProps}>
                  {copy.closing.cta}
                </BrutalButton>
                <BrutalButton variant="glass" {...signInProps}>
                  {copy.closing.signIn}
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
                <LocaleSwitch locale={locale} onChange={onToggleLocale} />
              </div>
              </div>
            </div>

            {/* Navigation columns */}
            <nav
              aria-label="Footer"
              className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7"
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
