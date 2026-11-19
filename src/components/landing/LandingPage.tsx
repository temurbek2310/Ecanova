import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEconovaGSAP } from '@/hooks/useEconovaGSAP';
import { getActiveLenisInstance } from '../../lib/scroll-sync';
import type { LocaleCode } from '../../shared/types';
import { ConstellationCanvas } from './ConstellationCanvas';
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
  kicker: string;
  headline: string;
  body: string;
  tags: string;
}

interface Capability {
  title: string;
  body: string;
}

interface LandingCopy {
  nav: { tracks: string; architecture: string; manifesto: string; launch: string };
  hero: {
    kicker: string;
    headline: string;
    body: string;
    cta: string;
    explore: string;
  };
  chapters: [Chapter, Chapter, Chapter];
  architecture: { kicker: string; headline: string; items: [Capability, Capability, Capability, Capability] };
  closing: { headline: string; cta: string; signIn: string };
  footer: { rights: string; github: string; community: string };
}

const COPY: Record<LocaleCode, LandingCopy> = {
  en: {
    nav: { tracks: 'Tracks', architecture: 'Architecture', manifesto: 'Manifesto', launch: 'Launch App' },
    hero: {
      kicker: 'BILINGUAL ACADEMIC ENGINE · O‘Z / EN',
      headline: 'Systemic thinking. Scalable models.',
      body: 'Master Economics, Mathematics and Business in one bilingual learning engine — every lesson, syllabus and credential verified on the server, never taken on trust.',
      cta: 'Launch Platform',
      explore: 'Explore Tracks ↓',
    },
    chapters: [
      {
        kicker: '01 · ECONOMICS',
        headline: 'Markets, modeled as living systems.',
        body: 'From macro cycles to strategic games, learn how incentives settle into equilibrium — and exactly what breaks it.',
        tags: 'Macroeconomics · Game Theory · Market Equilibrium',
      },
      {
        kicker: '02 · MATHEMATICS',
        headline: 'The structure beneath every decision.',
        body: 'Vectors, probability and models, built up from first principles until uncertainty becomes something you can compute.',
        tags: 'Linear Algebra · Probability · Quantitative Modeling',
      },
      {
        kicker: '03 · BUSINESS',
        headline: 'Strategy that scales, not just sounds right.',
        body: 'Unit economics to capital allocation: the numbers, trade-offs and system design behind companies that compound.',
        tags: 'Unit Economics · Capital Allocation · Strategic Systems',
      },
    ],
    architecture: {
      kicker: 'ARCHITECTURE',
      headline: 'Built like infrastructure.',
      items: [
        { title: '⌘K Spotlight CommandBar', body: 'Instant keyboard-first navigation' },
        { title: 'Dual-Edition Publishing', body: 'Native O‘Z and EN academic tracks' },
        { title: 'Offline Data Reconciliation', body: 'Seamless local persistence & sync' },
        { title: 'Verifiable Credentials', body: 'Print-ready syllabi & server-verified certificates' },
      ],
    },
    closing: { headline: 'Ready to think in systems?', cta: 'Enter ECONOVA', signIn: 'Sign In' },
    footer: { rights: 'All rights reserved.', github: 'GitHub', community: 'Community' },
  },
  uz: {
    nav: { tracks: 'Yo‘nalishlar', architecture: 'Arxitektura', manifesto: 'Manifest', launch: 'Kirish' },
    hero: {
      kicker: 'BILINGUAL ACADEMIC ENGINE · O‘Z / EN',
      headline: 'Tizimli tafakkur. Miqyosli modellar.',
      body: 'Iqtisodiyot, matematika va biznesni yagona ikki tilli o‘quv tizimida o‘zlashtiring — har bir dars, sillabus va sertifikat serverda tekshiriladi, ishonchga tayanmaydi.',
      cta: 'Platformaga o‘tish',
      explore: 'Yo‘nalishlar ↓',
    },
    chapters: [
      {
        kicker: '01 · IQTISODIYOT',
        headline: 'Bozorlar — tirik tizimlar sifatida.',
        body: 'Makro tsikllardan strategik o‘yinlargacha: rag‘batlar qanday muvozanatga kelishini va uni aynan nima buzishini o‘rganing.',
        tags: 'Makroiqtisodiyot · O‘yinlar nazariyasi · Bozor muvozanati',
      },
      {
        kicker: '02 · MATEMATIKA',
        headline: 'Har bir qaror ostidagi tuzilma.',
        body: 'Vektorlar, ehtimollik va modellar — noaniqlik hisoblanadigan narsaga aylanguniga qadar birinchi tamoyillardan quriladi.',
        tags: 'Chiziqli algebra · Ehtimollik · Miqdoriy modellashtirish',
      },
      {
        kicker: '03 · BIZNES',
        headline: 'Faqat jozibali emas, miqyoslanadigan strategiya.',
        body: 'Birlik iqtisodidan kapital taqsimotigacha: o‘sib boruvchi kompaniyalar ortidagi hisob-kitob, kelishuvlar va tizim dizayni.',
        tags: 'Birlik iqtisodi · Kapital taqsimoti · Strategik tizimlar',
      },
    ],
    architecture: {
      kicker: 'ARXITEKTURA',
      headline: 'Infratuzilma kabi qurilgan.',
      items: [
        { title: '⌘K Spotlight buyruq paneli', body: 'Klaviatura orqali tezkor navigatsiya' },
        { title: 'Ikki nashrli nashriyot', body: 'O‘Z va EN tillaridagi mahalliy akademik yo‘nalishlar' },
        { title: 'Oflayn ma‘lumotlar uyg‘unligi', body: 'Uzluksiz mahalliy saqlash va sinxronlash' },
        { title: 'Tekshiriladigan sertifikatlar', body: 'Chop etishga tayyor sillabuslar va serverda tasdiqlangan sertifikatlar' },
      ],
    },
    closing: { headline: 'Tizimli fikrlashga tayyormisiz?', cta: 'ECONOVA‘ga kirish', signIn: 'Hisobga kirish' },
    footer: { rights: 'Barcha huquqlar himoyalangan.', github: 'GitHub', community: 'Hamjamiyat' },
  },
};

/* ------------------------------------------------------------------ */
/* Shared presentational pieces                                        */
/* ------------------------------------------------------------------ */

const CONTAINER = 'relative z-10 mx-auto w-full max-w-[1280px] px-6 md:px-12';
const GHOST_LINK =
  'cursor-pointer bg-transparent p-0 text-[14px] font-semibold uppercase tracking-[0.025em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';

function PillCta({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center justify-center rounded-[22.5px] bg-[#8052ff] px-[20px] py-[14.4px] text-[14px] font-semibold uppercase tracking-[0.025em] text-white transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}

function LocaleSwitch({
  locale,
  onChange,
  small = false,
}: {
  locale: LocaleCode;
  onChange: (next: LocaleCode) => void;
  small?: boolean;
}) {
  const size = small ? 'text-[12px]' : 'text-[14px]';
  const base = `cursor-pointer bg-transparent p-0 font-semibold tracking-[0.025em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${size}`;
  return (
    <div role="group" aria-label="Language" className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={locale === 'en'}
        onClick={() => onChange('en')}
        className={`${base} ${locale === 'en' ? 'text-[#ffb829]' : 'text-[#9a9a9a] hover:text-white'}`}
      >
        EN
      </button>
      <span aria-hidden="true" className={`${size} text-[#9a9a9a]`}>
        /
      </span>
      <button
        type="button"
        lang="uz"
        aria-pressed={locale === 'uz'}
        onClick={() => onChange('uz')}
        className={`${base} ${locale === 'uz' ? 'text-[#ffb829]' : 'text-[#9a9a9a] hover:text-white'}`}
      >
        O‘Z
      </button>
    </div>
  );
}

function EconovaMark({ gradientId }: { gradientId: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8052ff" />
          <stop offset="1" stopColor="#15846e" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5 22 20.5H2L12 2.5ZM12 9.5 16.4 17.5H7.6L12 9.5Z"
        fill={`url(#${gradientId})`}
        fillRule="evenodd"
      />
    </svg>
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
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const gradientId = `econova-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Keep to a single filled pill per viewport: the navbar CTA only shows while neither in-page CTA is on screen.
  const [navCtaVisible, setNavCtaVisible] = useState(false);

  useEffect(() => {
    const targets = [heroCtaRef.current, finalCtaRef.current].filter(
      (el): el is HTMLDivElement => el !== null,
    );
    if (targets.length === 0 || typeof IntersectionObserver === 'undefined') {
      setNavCtaVisible(true);
      return;
    }
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setNavCtaVisible(visible.size === 0);
    });
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const lenis = getActiveLenisInstance();
    if (lenis) {
      lenis.scrollTo(el, { offset: 0, duration: 1.4 });
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const anchorProps = (id: string) => ({
    href: `#${id}`,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      scrollToId(id);
    },
  });

  useEconovaGSAP(
    rootRef,
    () => {
      const root = rootRef.current;
      if (!root) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      /* ---- Master scrub: scroll position → constellation progress ---- */
      let keys: ProgressKey[] = [[0, 0]];

      const measure = () => {
        const vh = window.innerHeight;
        const maxY = Math.max(1, ScrollTrigger.maxScroll(window));
        const el = (name: string) => root.querySelector<HTMLElement>(`[data-anchor="${name}"]`);
        const top = (node: HTMLElement | null) =>
          node ? node.getBoundingClientRect().top + window.scrollY : 0;
        const center = (node: HTMLElement | null) =>
          node ? top(node) + node.offsetHeight / 2 - vh / 2 : 0;

        const arch = el('arch');
        const archH = arch?.offsetHeight ?? vh;
        const raw: ProgressKey[] = [
          [0, 0],
          [top(el('tracks')) - vh * 0.6, 0.22], // brain holds while the hero is on screen
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
          scrollProgressRef.current = mapScrollToProgress(
            keys,
            proxy.value * Math.max(1, ScrollTrigger.maxScroll(window)),
          );
        },
      });

      /* ---- Text reveals ---- */
      if (!reduced) {
        const items = gsap.utils.toArray<HTMLElement>('[data-reveal]', root);
        gsap.set(items, { y: 28, opacity: 0 });
        ScrollTrigger.batch(items, {
          start: 'top 88%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              opacity: 1,
              duration: 0.9,
              ease: 'power3.out',
              stagger: 0.09,
              overwrite: true,
            }),
        });
      }

      // Web fonts / locale swaps change page height without a window resize.
      let raf = 0;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => ScrollTrigger.refresh());
      });
      observer.observe(root);

      return () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        ScrollTrigger.removeEventListener('refresh', measure);
      };
    },
    { dependencies: [] },
  );

  const [econ, math, biz] = copy.chapters;
  const chapters: Array<{ anchor: string; chapter: Chapter; right: boolean }> = [
    { anchor: 'econ', chapter: econ, right: false },
    { anchor: 'math', chapter: math, right: true },
    { anchor: 'biz', chapter: biz, right: false },
  ];

  return (
    <div
      ref={rootRef}
      lang={locale}
      className="econova-landing relative min-h-screen overflow-x-clip bg-black text-white"
    >
      <ConstellationCanvas progressRef={scrollProgressRef} />

      {/* Navbar — transparent over the void; a black→clear fade keeps links legible over passing copy. */}
      <header className="fixed inset-x-0 top-0 z-30">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-28"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0))' }}
        />
        <nav
          aria-label="Primary"
          className="relative mx-auto flex h-[72px] w-full max-w-[1280px] items-center justify-between gap-6 px-6 md:px-12"
        >
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              scrollToId('top');
            }}
            className="flex items-center gap-2.5 text-[14px] font-semibold uppercase tracking-[0.025em] text-white"
          >
            <EconovaMark gradientId={gradientId} />
            ECONOVA
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a {...anchorProps('tracks')} className={`${GHOST_LINK} text-[#9a9a9a] hover:text-white`}>
              {copy.nav.tracks}
            </a>
            <a {...anchorProps('architecture')} className={`${GHOST_LINK} text-[#9a9a9a] hover:text-white`}>
              {copy.nav.architecture}
            </a>
            <a {...anchorProps('manifesto')} className={`${GHOST_LINK} text-[#9a9a9a] hover:text-white`}>
              {copy.nav.manifesto}
            </a>
          </div>

          <div className="flex items-center gap-5 md:gap-8">
            <LocaleSwitch locale={locale} onChange={onToggleLocale} />
            <div
              aria-hidden={!navCtaVisible}
              className={`transition-opacity duration-500 ${navCtaVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              {...(navCtaVisible ? {} : { inert: true })}
            >
              <PillCta onClick={onEnterApp}>{copy.nav.launch}</PillCta>
            </div>
          </div>
        </nav>
      </header>

      <main id="top" className="relative z-10">
        {/* Hero */}
        <section className="flex min-h-screen items-end pb-24 pt-32 md:items-center md:py-0">
          <div className={CONTAINER}>
            <div className="max-w-[640px] md:w-[54%]">
              <p data-reveal className="landing-kicker text-[#ffb829]">
                {copy.hero.kicker}
              </p>
              <h1 data-reveal className="landing-display mt-8 text-white">
                {copy.hero.headline}
              </h1>
              <p data-reveal className="landing-body mt-8 max-w-[460px] text-white/90">
                {copy.hero.body}
              </p>
              <div data-reveal className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
                <div ref={heroCtaRef}>
                  <PillCta onClick={onEnterApp}>{copy.hero.cta}</PillCta>
                </div>
                <a {...anchorProps('tracks')} className={`${GHOST_LINK} text-[#9a9a9a] hover:text-white`}>
                  {copy.hero.explore}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Zigzag disciplines journey */}
        <section id="tracks" data-anchor="tracks">
          {chapters.map(({ anchor, chapter, right }) => (
            <article
              key={anchor}
              data-anchor={anchor}
              className="flex min-h-[90vh] items-center py-[56px]"
            >
              <div className={CONTAINER}>
                <div className={`md:w-[48%] ${right ? 'md:ml-auto' : ''}`}>
                  <p data-reveal className="landing-kicker text-[#ffb829]">
                    {chapter.kicker}
                  </p>
                  <h2
                    data-reveal
                    className="landing-headline-lg mt-6 text-white"
                    style={{ fontSize: 'clamp(42px, 5.5vw, 78px)' }}
                  >
                    {chapter.headline}
                  </h2>
                  <p data-reveal className="landing-body mt-8 max-w-[480px] text-white/90">
                    {chapter.body}
                  </p>
                  <p
                    data-reveal
                    className="mt-8 text-[14px] font-normal tracking-[0.025em] text-[#9a9a9a]"
                  >
                    {chapter.tags}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Platform capabilities */}
        <section id="architecture" data-anchor="arch" className="py-[120px]">
          <div className={CONTAINER}>
            <p data-reveal className="landing-kicker text-[#ffb829]">
              {copy.architecture.kicker}
            </p>
            <h2 data-reveal className="landing-headline-lg mt-6 max-w-[900px] text-white">
              {copy.architecture.headline}
            </h2>
            <ol className="mt-[96px] grid list-none gap-x-[96px] gap-y-[96px] p-0 md:grid-cols-2">
              {copy.architecture.items.map((item, i) => (
                <li key={item.title} data-reveal>
                  <span className="landing-kicker text-[#ffb829]">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="landing-headline-sm mt-4 text-white">{item.title}</h3>
                  <p className="landing-body mt-4 max-w-[480px] text-[#bdbdbd]">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Final CTA + footer */}
        <section id="manifesto" data-anchor="cta" className="flex min-h-screen flex-col py-32">
          <div className={`${CONTAINER} flex flex-1 flex-col`}>
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <h2 data-reveal className="landing-display mx-auto max-w-[960px] text-white">
                {copy.closing.headline}
              </h2>
              <div data-reveal ref={finalCtaRef} className="mt-14">
                <PillCta onClick={onEnterApp}>{copy.closing.cta}</PillCta>
              </div>
              <button
                type="button"
                data-reveal
                onClick={onSignIn}
                className={`${GHOST_LINK} mt-8 text-[#9a9a9a] hover:text-white`}
              >
                {copy.closing.signIn}
              </button>
            </div>

            <footer className="mt-24 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-[12px] text-[#9a9a9a]">
              <p>
                © {new Date().getFullYear()} ECONOVA. {copy.footer.rights}
              </p>
              <LocaleSwitch locale={locale} onChange={onToggleLocale} small />
              <div className="flex items-center gap-6">
                <a
                  href="https://github.com/temurbek2310/Ecanova"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  {copy.footer.github}
                </a>
                <a href="/community" className="transition-colors hover:text-white">
                  {copy.footer.community}
                </a>
              </div>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
