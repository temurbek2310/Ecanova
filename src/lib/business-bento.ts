import type { LocaleCode } from '../shared/types';

export interface BusinessBentoModule {
  id: string;
  code: string;
  title: string;
  metricBadge: string;
  metricValue: string;
  summary: string;
  deliverable: string;
  accentColor:
    | 'var(--econova-accent)'
    | 'var(--econova-teal)'
    | 'var(--econova-success)'
    | 'var(--econova-warning)';
  accentTextClass: string;
  accentBgClass: string;
  gridSpanClass: string;
  stackOrder: number;
  stackOffsetPx: number;
  initialTranslateYPx: number;
}

export interface StackTransformState {
  y: number;
  scale: number;
  zIndex: number;
}

export interface ViewportDimensions {
  width: number;
  height: number;
}

export const BUSINESS_RESIZE_DEBOUNCE_MS = 120;

/**
 * Determines whether a window resize event represents a meaningful viewport
 * dimension change (>= 1px) that warrants refreshing BusinessSection ScrollTriggers.
 */
export function shouldRefreshBusinessLayoutOnResize(
  previous: ViewportDimensions | null,
  next: ViewportDimensions
): boolean {
  if (
    !Number.isFinite(next.width) ||
    !Number.isFinite(next.height) ||
    next.width <= 0 ||
    next.height <= 0
  ) {
    return false;
  }
  if (!previous) return true;
  return (
    Math.abs(next.width - previous.width) >= 1 ||
    Math.abs(next.height - previous.height) >= 1
  );
}

/**
 * Pure decoupled builder for the Business "Structure & High-Impact" asymmetrical bento-box
 * modules and GSAP ScrollTrigger aggressive card-stacking math.
 */
export function buildBusinessBentoModules(locale: LocaleCode): BusinessBentoModule[] {
  const isUz = locale === 'uz';

  return [
    {
      id: 'unit-economics',
      code: isUz ? 'MOD-01 · ASOSIY DVIGATEL' : 'MOD-01 · CORE ENGINE',
      title: isUz
        ? 'Unit-iqtisodiyot: LTV / CAC va marjinal daromad'
        : 'Unit Economics: Contribution Margin & LTV / CAC',
      metricBadge: isUz ? 'Maqsadli nisbat' : 'Target Ratio',
      metricValue: 'LTV : CAC ≥ 3.2×',
      summary: isUz
        ? 'Har bir mijoz kohortasi bo‘yicha o‘zgaruvchan xarajatlar, ulush marjasi va o‘zini oqlash muddatini tahlil qiling.'
        : 'Dissect cohort retention, variable fulfillment costs, and payback velocity before scaling acquisition.',
      deliverable: isUz ? 'Kohorta rentabellik matritsasi' : 'Cohort Payback & Margin Matrix',
      accentColor: 'var(--econova-accent)',
      accentTextClass: 'text-theme-accent',
      accentBgClass: 'bg-theme-accent',
      gridSpanClass: 'lg:col-span-7',
      stackOrder: 1,
      stackOffsetPx: 0,
      initialTranslateYPx: 0,
    },
    {
      id: 'cash-conversion',
      code: isUz ? 'MOD-02 · LIKVIDLIK' : 'MOD-02 · LIQUIDITY',
      title: isUz
        ? 'Pul oqimi va aylanma mablag‘lar sikli'
        : 'Cash Conversion Cycle & Working Capital Runway',
      metricBadge: isUz ? 'Erkin pul oqimi' : 'FCF Conversion',
      metricValue: isUz ? 'CCC −14 kun' : 'CCC −14 Days',
      summary: isUz
        ? 'Debitorlik, inventar va kreditorlik muddatlarini muvozanatlash orqali operatsion likvidlikni boshqaring.'
        : 'Structure receivables, inventory turns, and supplier terms so growth compounds operating cash.',
      deliverable: isUz ? '13-haftalik likvidlik modeli' : '13-Week Cash Flow Stress Ledger',
      accentColor: 'var(--econova-teal)',
      accentTextClass: 'text-theme-cyan',
      accentBgClass: 'bg-theme-cyan',
      gridSpanClass: 'lg:col-span-5',
      stackOrder: 2,
      stackOffsetPx: 14,
      initialTranslateYPx: 0,
    },
    {
      id: 'capital-allocation',
      code: isUz ? 'MOD-03 · KAPITAL O‘SISHI' : 'MOD-03 · COMPOUNDING',
      title: isUz
        ? 'Kapital taqsimoti: ROIC va WACC chegaralari'
        : 'Capital Allocation: ROIC vs. WACC Hurdle Rates',
      metricBadge: isUz ? 'Qiymat spredi' : 'Economic Spread',
      metricValue: 'ROIC − WACC +8.4%',
      summary: isUz
        ? 'Reinvestitsiya, qarzni so‘ndirish va organik kengayish qarorlarini sof joriy qiymat (NPV) asosida baholang.'
        : 'Rank organic reinvestment, M&A discipline, and balance-sheet resilience against risk-adjusted hurdle rates.',
      deliverable: isUz ? 'Kapital byudjeti memorandum' : 'Board Capital Allocation Memo',
      accentColor: 'var(--econova-success)',
      accentTextClass: 'text-theme-emerald',
      accentBgClass: 'bg-theme-emerald',
      gridSpanClass: 'lg:col-span-5',
      stackOrder: 3,
      stackOffsetPx: 28,
      initialTranslateYPx: 8,
    },
    {
      id: 'moat-pricing',
      code: isUz ? 'MOD-04 · STRATEGIYA' : 'MOD-04 · STRATEGY',
      title: isUz
        ? 'Raqobat ustunligi va narx elastikligi arxitekturasi'
        : 'Competitive Moats, Switching Costs & Pricing Power',
      metricBadge: isUz ? 'Sof ushlab qolish' : 'Net Retention',
      metricValue: 'NRR 118.5%',
      summary: isUz
        ? 'Tarmoq effektlari, almashish xarajatlari va tabaqalashtirilgan tariflar orqali uzoq muddatli marjani himoyalang.'
        : 'Quantify willingness-to-pay tiers, switching friction, and economies of scale under competitive pressure.',
      deliverable: isUz ? 'Narx va elastiklik ssenariysi' : 'Tiered Pricing & Elasticity Stress Model',
      accentColor: 'var(--econova-warning)',
      accentTextClass: 'text-theme-amber',
      accentBgClass: 'bg-theme-amber',
      gridSpanClass: 'lg:col-span-7',
      stackOrder: 4,
      stackOffsetPx: 42,
      initialTranslateYPx: 12,
    },
  ];
}

/**
 * Computes the bounded vertical pin travel (in px) so an internal pinned Bento stage
 * stops scrubbing cleanly before its bottom edge reaches the bottom border of its track.
 */
export function computeBoundedPinTravelPx(
  trackHeightPx: number,
  stageHeightPx: number,
  safetyMarginPx = 16
): number {
  if (!Number.isFinite(trackHeightPx) || !Number.isFinite(stageHeightPx)) {
    return 0;
  }
  const safeMargin = Number.isFinite(safetyMarginPx) ? Math.max(0, safetyMarginPx) : 0;
  return Math.max(0, Math.round(trackHeightPx - stageHeightPx - safeMargin));
}

/**
 * Computes the vertical translation (`y`), scale, and `zIndex` for a bento card
 * at a normalized GSAP ScrollTrigger scrub progress (`0..1`).
 */
export function computeBusinessCardStackTransform(
  moduleItem: BusinessBentoModule,
  scrollProgress: number,
  totalCards = 4
): StackTransformState {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(scrollProgress) ? scrollProgress : 0));
  const indexZero = Math.max(0, moduleItem.stackOrder - 1);

  if (indexZero === 0) {
    // Base card stays anchored at y=0 and subtly compresses as upper cards lock onto the stack
    const compression = Number((1 - clamped * 0.03).toFixed(4));
    return {
      y: 0,
      scale: compression,
      zIndex: 10,
    };
  }

  // Stagger each subsequent card's arrival window across the scroll range
  const windowSize = 1 / Math.max(1, totalCards - 1);
  const startAt = (indexZero - 1) * windowSize * 0.85;
  const endAt = Math.min(1, startAt + windowSize * 1.15);
  const localProgress = Math.max(
    0,
    Math.min(1, (clamped - startAt) / Math.max(0.0001, endAt - startAt))
  );

  const y = Number(
    (
      moduleItem.initialTranslateYPx * (1 - localProgress) +
      moduleItem.stackOffsetPx * localProgress
    ).toFixed(2)
  );
  const depthAfterLock = Math.max(0, clamped - endAt);
  const scale = Number((1 - depthAfterLock * 0.02).toFixed(4));

  return {
    y,
    scale,
    zIndex: 10 + indexZero * 10,
  };
}
