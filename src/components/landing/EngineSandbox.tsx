import { useId, useMemo, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { LocaleCode } from '../../shared/types';

/**
 * Live Engine Sandbox — a 15-second, sign-up-free taste of an ECONOVA lesson.
 *
 * Three real, closed-form models (one per track) recompute on every slider move:
 *  - Economics:   linear supply & demand with a per-unit tax → equilibrium, tax revenue, deadweight loss
 *  - Mathematics: binomial distribution → mean, σ, P(X ≥ k) with the PMF as bars
 *  - Business:    unit economics → contribution margin, break-even volume, profit lines
 *
 * Every result carries a deterministic FNV-1a signature of (track, inputs, rounded outputs):
 * identical inputs always yield the identical signature.
 *
 * Both locales are rendered into one grid cell (`.lp-bi`, see landing.css) so O‘Z / EN never
 * reflows the block, and every chart is a fixed-viewBox SVG so values can't change its size.
 */

export type SandboxTrack = 'econ' | 'math' | 'biz';

const TRACKS: readonly SandboxTrack[] = ['econ', 'math', 'biz'];
const LOCALES: readonly LocaleCode[] = ['en', 'uz'];
const ACCENT: Record<SandboxTrack, string> = { econ: '#5DE1D2', math: '#9274FF', biz: '#6FE0A1' };

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

interface ModelCopy {
  title: string;
  formula: string;
  params: [string, string, string];
  outputs: [string, string, string];
  axisX: string;
  axisY: string;
  legend: [string, string];
  cta: string;
}

interface SandboxCopy {
  badge: string;
  headline: string;
  body: string;
  hint: string;
  tracksLabel: string;
  tabs: Record<SandboxTrack, string>;
  models: Record<SandboxTrack, ModelCopy>;
  check: string;
  checkNote: string;
  noBreakEven: string;
  units: string;
}

/** Non-breaking spaces inside each equation, so narrow screens only wrap at the `·` separator. */
const ECON_FORMULA = 'Qd = a − 2P · Qs = −10 + d(P − t)'
  .split(' · ')
  .map((eq) => eq.replace(/ /g, ' '))
  .join('  ·  ');

const COPY: Record<LocaleCode, SandboxCopy> = {
  en: {
    badge: '[ LIVE ENGINE SANDBOX ]',
    headline: 'Try a lesson in 15 seconds.',
    body: 'Pick a track, move the parameters and watch the model recompute instantly — no sign-up needed.',
    hint: '≈ 15 s · no account',
    tracksLabel: 'Choose a track',
    tabs: { econ: 'Economics', math: 'Mathematics', biz: 'Business' },
    models: {
      econ: {
        title: 'Market equilibrium with a per-unit tax',
        formula: ECON_FORMULA,
        params: ['Demand level (a)', 'Supply responsiveness (d)', 'Per-unit tax (t)'],
        outputs: ['Equilibrium price', 'Equilibrium quantity', 'Deadweight loss'],
        axisX: 'Quantity',
        axisY: 'Price',
        legend: ['Demand', 'Supply + tax'],
        cta: 'Start the Economics track',
      },
      math: {
        title: 'Binomial probability',
        formula: 'P(X = i) = C(n, i) · pⁱ · (1 − p)ⁿ⁻ⁱ',
        params: ['Trials (n)', 'Success probability (p)', 'Threshold (k)'],
        outputs: ['Expected value', 'Standard deviation', 'P(X ≥ k)'],
        axisX: 'Successes',
        axisY: 'Probability',
        legend: ['X < k', 'X ≥ k'],
        cta: 'Start the Mathematics track',
      },
      biz: {
        title: 'Unit economics & break-even',
        formula: 'Break-even = Fixed costs ÷ (Price − Variable cost)',
        params: ['Price per unit', 'Variable cost per unit', 'Fixed costs'],
        outputs: ['Contribution margin', 'Margin ratio', 'Break-even volume'],
        axisX: 'Units sold',
        axisY: 'Dollars',
        legend: ['Revenue', 'Total cost'],
        cta: 'Start the Business track',
      },
    },
    check: 'Deterministic check',
    checkNote: 'Same inputs → same signature. Lessons are graded with the same deterministic rules on the server.',
    noBreakEven: 'Price ≤ variable cost: no break-even',
    units: 'units',
  },
  uz: {
    badge: '[ JONLI SINOV MAYDONI ]',
    headline: 'Darsni 15 soniyada sinab ko‘ring.',
    body: 'Yo‘nalishni tanlang, parametrlarni o‘zgartiring va model qanday darhol qayta hisoblanishini ko‘ring — ro‘yxatdan o‘tish shart emas.',
    hint: '≈ 15 soniya · hisobsiz',
    tracksLabel: 'Yo‘nalishni tanlang',
    tabs: { econ: 'Iqtisodiyot', math: 'Matematika', biz: 'Biznes' },
    models: {
      econ: {
        title: 'Birlik solig‘i bilan bozor muvozanati',
        formula: ECON_FORMULA,
        params: ['Talab darajasi (a)', 'Taklif sezgirligi (d)', 'Birlik uchun soliq (t)'],
        outputs: ['Muvozanat narxi', 'Muvozanat miqdori', 'Samaradorlik yo‘qotishi'],
        axisX: 'Miqdor',
        axisY: 'Narx',
        legend: ['Talab', 'Taklif + soliq'],
        cta: 'Iqtisodiyot yo‘nalishini boshlash',
      },
      math: {
        title: 'Binomial ehtimollik',
        formula: 'P(X = i) = C(n, i) · pⁱ · (1 − p)ⁿ⁻ⁱ',
        params: ['Tajribalar soni (n)', 'Muvaffaqiyat ehtimoli (p)', 'Chegara (k)'],
        outputs: ['Kutilgan qiymat', 'Standart chetlanish', 'P(X ≥ k)'],
        axisX: 'Muvaffaqiyatlar',
        axisY: 'Ehtimollik',
        legend: ['X < k', 'X ≥ k'],
        cta: 'Matematika yo‘nalishini boshlash',
      },
      biz: {
        title: 'Birlik iqtisodiyoti va zararsizlik nuqtasi',
        formula: 'Zararsizlik = Doimiy xarajat ÷ (Narx − O‘zgaruvchan xarajat)',
        params: ['Birlik narxi', 'Birlik o‘zgaruvchan xarajati', 'Doimiy xarajatlar'],
        outputs: ['Marjinal daromad', 'Marja ulushi', 'Zararsizlik hajmi'],
        axisX: 'Sotilgan birliklar',
        axisY: 'Dollar',
        legend: ['Tushum', 'Jami xarajat'],
        cta: 'Biznes yo‘nalishini boshlash',
      },
    },
    check: 'Deterministik tekshiruv',
    checkNote: 'Bir xil kiritma → bir xil imzo. Darslar serverda aynan shu deterministik qoidalar bilan baholanadi.',
    noBreakEven: 'Narx ≤ o‘zgaruvchan xarajat: zararsizlik nuqtasi yo‘q',
    units: 'birlik',
  },
};

/* ------------------------------------------------------------------ */
/* Formatting & bilingual rendering                                    */
/* ------------------------------------------------------------------ */

interface Fmt {
  num: (v: number, digits?: number) => string;
  pct: (v: number, digits?: number) => string;
  usd: (v: number) => string;
}

const FMT: Record<LocaleCode, Fmt> = (() => {
  const make = (tag: string): Fmt => {
    const cache = new Map<number, Intl.NumberFormat>();
    const nf = (d: number) => {
      let f = cache.get(d);
      if (!f) {
        f = new Intl.NumberFormat(tag, { minimumFractionDigits: d, maximumFractionDigits: d });
        cache.set(d, f);
      }
      return f;
    };
    return {
      num: (v, d = 0) => nf(d).format(v),
      pct: (v, d = 1) => `${nf(d).format(v * 100)}%`,
      usd: (v) => `$${nf(0).format(Math.round(v))}`,
    };
  };
  return { en: make('en-US'), uz: make('uz-UZ') };
})();

/** Both editions in one grid cell (shift-free); only the active one is visible / exposed. */
function Dual({
  locale,
  pick,
  block,
}: {
  locale: LocaleCode;
  pick: (copy: SandboxCopy, fmt: Fmt) => ReactNode;
  block?: boolean;
}) {
  return (
    <span className={block ? 'lp-bi lp-bi--block' : 'lp-bi'}>
      {LOCALES.map((l) => (
        <span key={l} lang={l} className="lp-bi__ed" aria-hidden={l === locale ? undefined : true}>
          {pick(COPY[l], FMT[l])}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Models                                                              */
/* ------------------------------------------------------------------ */

interface ParamDef {
  min: number;
  max: number;
  step: number;
  initial: number;
  /** Display formatter for the live value. */
  show: (v: number, fmt: Fmt) => string;
}

const PARAMS: Record<SandboxTrack, [ParamDef, ParamDef, ParamDef]> = {
  econ: [
    { min: 60, max: 140, step: 5, initial: 100, show: (v, f) => f.num(v) },
    { min: 1, max: 3, step: 0.1, initial: 1.5, show: (v, f) => f.num(v, 1) },
    { min: 0, max: 15, step: 1, initial: 5, show: (v, f) => f.usd(v) },
  ],
  math: [
    { min: 5, max: 30, step: 1, initial: 12, show: (v, f) => f.num(v) },
    { min: 0.05, max: 0.95, step: 0.05, initial: 0.5, show: (v, f) => f.num(v, 2) },
    { min: 0, max: 30, step: 1, initial: 8, show: (v, f) => f.num(v) },
  ],
  biz: [
    { min: 10, max: 100, step: 1, initial: 40, show: (v, f) => f.usd(v) },
    { min: 5, max: 90, step: 1, initial: 22, show: (v, f) => f.usd(v) },
    { min: 1000, max: 20000, step: 500, initial: 6000, show: (v, f) => f.usd(v) },
  ],
};

type Values = [number, number, number];

const initialValues = (): Record<SandboxTrack, Values> => ({
  econ: PARAMS.econ.map((p) => p.initial) as Values,
  math: PARAMS.math.map((p) => p.initial) as Values,
  biz: PARAMS.biz.map((p) => p.initial) as Values,
});

/** Chart plot box inside the fixed 320 × 190 viewBox. */
const VB_W = 320;
const VB_H = 190;
const PLOT = { x0: 34, x1: 310, y0: 12, y1: 162 };

interface Result {
  /** Raw outputs (for the signature) and their per-locale display. */
  raw: number[];
  show: [(f: Fmt) => string, (f: Fmt) => string, (f: Fmt) => string];
  chart: ReactNode;
  /** No-break-even style warning (business only). */
  warn?: boolean;
}

const sx = (x: number, max: number) => PLOT.x0 + (Math.min(Math.max(x, 0), max) / max) * (PLOT.x1 - PLOT.x0);
const sy = (y: number, max: number) => PLOT.y1 - (Math.min(Math.max(y, 0), max) / max) * (PLOT.y1 - PLOT.y0);

function econModel([a, d, t]: Values, accent: string): Result {
  // Demand Qd = a − 2P; supply Qs = −10 + d(P − t) (sellers keep P − t).
  const price = (a + 10 + d * t) / (2 + d);
  const qty = Math.max(0, a - 2 * price);
  const qtyNoTax = Math.max(0, a - (2 * (a + 10)) / (2 + d));
  const revenue = t * qty;
  const dwl = 0.5 * t * Math.max(0, qtyNoTax - qty);
  const QMAX = 140;
  const PMAX = 70;
  // Demand: P = (a − Q) / 2 ; supply (buyer price): P = (Q + 10) / d + t.
  const demand = `M${sx(0, QMAX)},${sy(a / 2, PMAX)} L${sx(a, QMAX)},${sy(0, PMAX)}`;
  const supplyAt = (q: number, tax: number) => (q + 10) / d + tax;
  const qTop = (PMAX - t) * d - 10; // where the supply line leaves the plot
  const supply = `M${sx(0, QMAX)},${sy(supplyAt(0, t), PMAX)} L${sx(Math.min(QMAX, qTop), QMAX)},${sy(supplyAt(Math.min(QMAX, qTop), t), PMAX)}`;
  const qTop0 = PMAX * d - 10;
  const supply0 = `M${sx(0, QMAX)},${sy(supplyAt(0, 0), PMAX)} L${sx(Math.min(QMAX, qTop0), QMAX)},${sy(supplyAt(Math.min(QMAX, qTop0), 0), PMAX)}`;
  const ex = sx(qty, QMAX);
  const ey = sy(price, PMAX);
  return {
    raw: [price, qty, revenue, dwl],
    show: [(f) => f.usd(price), (f) => f.num(qty, 1), (f) => f.usd(dwl)],
    chart: (
      <>
        {t > 0 && <path d={supply0} className="lp-sbx__line lp-sbx__line--ghost" />}
        <path d={demand} className="lp-sbx__line" style={{ stroke: '#F4F7FA' }} />
        <path d={supply} className="lp-sbx__line" style={{ stroke: accent }} />
        <path d={`M${PLOT.x0},${ey} H${ex} V${PLOT.y1}`} className="lp-sbx__guide" />
        <circle cx={ex} cy={ey} r={5} className="lp-sbx__dot" style={{ fill: accent }} />
      </>
    ),
  };
}

function mathModel([n, p, kRaw]: Values, accent: string): Result {
  const k = Math.min(kRaw, n);
  const pmf: number[] = [Math.pow(1 - p, n)];
  for (let i = 0; i < n; i++) pmf.push((pmf[i] * (n - i) * p) / ((i + 1) * (1 - p)));
  let tail = 0;
  for (let i = k; i <= n; i++) tail += pmf[i];
  tail = Math.min(1, tail);
  const mean = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  const peak = Math.max(...pmf);
  const slot = (PLOT.x1 - PLOT.x0) / (n + 1);
  const bw = Math.max(2, slot * 0.72);
  return {
    raw: [mean, sd, tail],
    show: [(f) => f.num(mean, 2), (f) => f.num(sd, 2), (f) => f.pct(tail, 1)],
    chart: (
      <>
        {pmf.map((v, i) => {
          const h = (v / peak) * (PLOT.y1 - PLOT.y0);
          return (
            <rect
              key={i}
              x={PLOT.x0 + i * slot + (slot - bw) / 2}
              y={PLOT.y1 - h}
              width={bw}
              height={h}
              rx={1.5}
              className="lp-sbx__bar"
              style={{ fill: i >= k ? accent : 'rgba(244, 247, 250, 0.28)' }}
            />
          );
        })}
      </>
    ),
  };
}

function bizModel([price, unitCost, fixed]: Values, accent: string): Result {
  const margin = price - unitCost;
  const ratio = margin / price;
  const viable = margin > 0;
  const breakEven = viable ? Math.ceil(fixed / margin) : Infinity;
  const VMAX = viable ? Math.max(200, Math.min(4000, breakEven * 2)) : 1000;
  const YMAX = Math.max(price * VMAX, fixed + unitCost * VMAX) * 1.04;
  const revenue = `M${sx(0, VMAX)},${sy(0, YMAX)} L${sx(VMAX, VMAX)},${sy(price * VMAX, YMAX)}`;
  const cost = `M${sx(0, VMAX)},${sy(fixed, YMAX)} L${sx(VMAX, VMAX)},${sy(fixed + unitCost * VMAX, YMAX)}`;
  const bx = viable ? sx(breakEven, VMAX) : 0;
  const by = viable ? sy(price * breakEven, YMAX) : 0;
  return {
    raw: [margin, ratio, viable ? breakEven : -1],
    show: [(f) => f.usd(margin), (f) => f.pct(ratio, 1), (f) => (viable ? `${f.num(breakEven)}` : '—')],
    warn: !viable,
    chart: (
      <>
        <path d={cost} className="lp-sbx__line" style={{ stroke: '#F4F7FA' }} />
        <path d={revenue} className="lp-sbx__line" style={{ stroke: accent }} />
        {viable && (
          <>
            <path d={`M${bx},${by} V${PLOT.y1}`} className="lp-sbx__guide" />
            <circle cx={bx} cy={by} r={5} className="lp-sbx__dot" style={{ fill: accent }} />
          </>
        )}
      </>
    ),
  };
}

const MODELS: Record<SandboxTrack, (v: Values, accent: string) => Result> = {
  econ: econModel,
  math: mathModel,
  biz: bizModel,
};

/** FNV-1a (32-bit) over a canonical string: deterministic, dependency-free signature. */
function signature(track: SandboxTrack, values: Values, raw: number[]): string {
  const canonical = `${track}|${values.map((v) => v.toFixed(4)).join(',')}|${raw.map((v) => v.toFixed(4)).join(',')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export interface EngineSandboxProps {
  locale: LocaleCode;
  /** Route props for "start this track" (the track's real course page). */
  trackLink: (track: SandboxTrack) => {
    href: string;
    onClick: (e: ReactMouseEvent<HTMLElement>) => void;
  };
}

export function EngineSandbox({ locale, trackLink }: EngineSandboxProps) {
  const [track, setTrack] = useState<SandboxTrack>('econ');
  const [values, setValues] = useState(initialValues);
  const uid = useId();
  const accent = ACCENT[track];
  const copy = COPY[locale];
  const defs = PARAMS[track];
  const current = values[track];

  // The binomial threshold can never exceed the trial count.
  const effective: Values = track === 'math' ? [current[0], current[1], Math.min(current[2], current[0])] : current;
  const result = useMemo(() => MODELS[track](effective, accent), [track, effective[0], effective[1], effective[2], accent]); // eslint-disable-line react-hooks/exhaustive-deps
  const sig = signature(track, effective, result.raw);

  const setParam = (i: number, v: number) =>
    setValues((prev) => {
      const next = [...prev[track]] as Values;
      next[i] = v;
      return { ...prev, [track]: next };
    });

  const link = trackLink(track);

  return (
    <div className="lp-sbx" style={{ '--lp-accent': accent } as CSSProperties}>
      <div className="lp-sbx__head">
        <div className="min-w-0">
          <p className="lp-badge" style={{ '--lp-accent': '#5DE1D2' } as CSSProperties}>
            <Dual locale={locale} pick={(c) => c.badge} />
          </p>
          <h2 id="sandbox-title" className="lp-heading-lg mt-5 max-w-[720px]">
            <Dual locale={locale} block pick={(c) => c.headline} />
          </h2>
        </div>
        <div className="lp-sbx__intro">
          <p className="lp-body">
            <Dual locale={locale} block pick={(c) => c.body} />
          </p>
          <p className="lp-sbx__hint">
            <span aria-hidden="true" className="lp-pulse" />
            <Dual locale={locale} pick={(c) => c.hint} />
          </p>
        </div>
      </div>

      <div className="lp-panel lp-sbx__panel">
        {/* Track switcher */}
        <div role="group" aria-label={copy.tracksLabel} className="lp-sbx__tabs">
          {TRACKS.map((tr) => (
            <button
              key={tr}
              type="button"
              aria-pressed={tr === track}
              onClick={() => setTrack(tr)}
              className="lp-sbx__tab"
              style={{ '--lp-accent': ACCENT[tr] } as CSSProperties}
            >
              <span aria-hidden="true" className="lp-sbx__tab-dot" />
              <Dual locale={locale} pick={(c) => c.tabs[tr]} />
            </button>
          ))}
        </div>

        <div className="lp-sbx__grid">
          {/* Inputs */}
          <div className="lp-sbx__controls">
            <p className="lp-index">
              <Dual locale={locale} pick={(c) => c.models[track].title} />
            </p>
            <p className="lp-sbx__formula">
              <Dual locale={locale} block pick={(c) => c.models[track].formula} />
            </p>

            {defs.map((def, i) => {
              const id = `${uid}-${track}-${i}`;
              const max = track === 'math' && i === 2 ? effective[0] : def.max;
              const value = Math.min(current[i], max);
              return (
                <div key={id} className="lp-sbx__field">
                  <div className="lp-sbx__field-row">
                    <label htmlFor={id} className="lp-sbx__label">
                      <Dual locale={locale} pick={(c) => c.models[track].params[i]} />
                    </label>
                    <output htmlFor={id} className="lp-sbx__value">
                      <Dual locale={locale} pick={(_, f) => def.show(value, f)} />
                    </output>
                  </div>
                  <input
                    id={id}
                    type="range"
                    min={def.min}
                    max={max}
                    step={def.step}
                    value={value}
                    aria-valuetext={def.show(value, FMT[locale])}
                    onChange={(e) => setParam(i, Number(e.target.value))}
                    className="lp-sbx__range"
                    style={{ '--lp-fill': `${((value - def.min) / Math.max(1e-9, max - def.min)) * 100}%` } as CSSProperties}
                  />
                </div>
              );
            })}
          </div>

          {/* Live output */}
          <div className="lp-sbx__output">
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="lp-sbx__chart"
              role="img"
              aria-label={`${copy.models[track].title}: ${copy.models[track].outputs
                .map((o, i) => `${o} ${result.show[i](FMT[locale])}`)
                .join(', ')}`}
            >
              <path d={`M${PLOT.x0},${PLOT.y0} V${PLOT.y1} H${PLOT.x1}`} className="lp-sbx__axis" />
              {result.chart}
              <text x={PLOT.x1} y={VB_H - 8} textAnchor="end" className="lp-sbx__axis-label">
                {copy.models[track].axisX}
              </text>
              <text x={PLOT.x0 - 6} y={PLOT.y0 + 2} textAnchor="end" className="lp-sbx__axis-label" transform={`rotate(-90 ${PLOT.x0 - 6} ${PLOT.y0 + 2})`}>
                {copy.models[track].axisY}
              </text>
            </svg>
            <ul className="lp-sbx__legend" aria-hidden="true">
              <li>
                <span style={{ background: track === 'math' ? 'rgba(244, 247, 250, 0.28)' : '#F4F7FA' }} />
                <Dual locale={locale} pick={(c) => c.models[track].legend[0]} />
              </li>
              <li>
                <span style={{ background: accent }} />
                <Dual locale={locale} pick={(c) => c.models[track].legend[1]} />
              </li>
            </ul>

            <dl className="lp-sbx__stats">
              {[0, 1, 2].map((i) => (
                <div key={i} className="lp-sbx__stat">
                  <dt>
                    <Dual locale={locale} pick={(c) => c.models[track].outputs[i]} />
                  </dt>
                  <dd>
                    <Dual locale={locale} pick={(_, f) => result.show[i](f)} />
                    {track === 'biz' && i === 2 && !result.warn && (
                      <small>
                        {' '}
                        <Dual locale={locale} pick={(c) => c.units} />
                      </small>
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Reserved line: the warning toggles visibility only, never height. */}
            <p className="lp-sbx__warn" aria-live="polite" data-show={result.warn ? '' : undefined}>
              {result.warn ? <Dual locale={locale} pick={(c) => c.noBreakEven} /> : ' '}
            </p>

            <div className="lp-sbx__footer">
              <div className="lp-sbx__check" title={copy.checkNote}>
                <ShieldCheck aria-hidden="true" size={18} strokeWidth={2.25} />
                <div className="min-w-0">
                  <p className="lp-sbx__check-title">
                    <Dual locale={locale} pick={(c) => c.check} />{' '}
                    <code>#{sig}</code>
                  </p>
                  <p className="lp-sbx__check-note">
                    <Dual locale={locale} block pick={(c) => c.checkNote} />
                  </p>
                </div>
              </div>
              <a href={link.href} onClick={link.onClick} className="lp-btn lp-btn--primary lp-sbx__cta">
                <span>
                  <Dual locale={locale} pick={(c) => c.models[track].cta} />
                </span>
                <ArrowUpRight aria-hidden="true" className="lp-btn__icon" strokeWidth={2.5} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EngineSandbox;
