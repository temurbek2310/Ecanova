import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { LocaleCode, SimulationType } from '../../shared/types';
import { t } from '../../lib/i18n';

interface InteractiveSimulationProps {
  type: SimulationType;
  locale: LocaleCode;
}

export const InteractiveSimulation: React.FC<InteractiveSimulationProps> = ({ type, locale }) => {
  const simStrings = t(locale).simulations;
  // Supply & Demand state
  const [demandShift, setDemandShift] = useState(0);
  const [supplyShift, setSupplyShift] = useState(0);
  const [priceCeiling, setPriceCeiling] = useState<number>(10); // 10 = unbinding

  // Calculus Tangent state
  const [evalX, setEvalX] = useState(6);

  // Unit Economics state
  const [arpa, setArpa] = useState(60);
  const [marginPct, setMarginPct] = useState(75);
  const [churnPct, setChurnPct] = useState(5);
  const [cac, setCac] = useState(270);

  if (type === 'none') return null;

  if (type === 'supply_demand') {
    // Qd = (100 + demandShift) - 10P ; Qs = (20 + supplyShift) + 10P
    const pStar = Math.max(1, Math.min(9, (80 + demandShift - supplyShift) / 20));
    const qStar = Math.max(0, 100 + demandShift - 10 * pStar);
    const bindingCap = priceCeiling < pStar;
    const activePrice = bindingCap ? priceCeiling : pStar;
    const qdAtActive = Math.max(0, 100 + demandShift - 10 * activePrice);
    const qsAtActive = Math.max(0, 20 + supplyShift + 10 * activePrice);
    const shortage = Math.max(0, qdAtActive - qsAtActive);

    const toSvgX = (q: number) => 44 + (Math.min(130, Math.max(0, q)) / 130) * 320;
    const toSvgY = (p: number) => 200 - (Math.min(10, Math.max(0, p)) / 10) * 168;

    return (
      <section
        aria-label={locale === 'uz' ? 'Interaktiv talab va taklif modeli' : 'Interactive Supply and Demand Model'}
        className="rounded-xl border-2 border-slate-500 bg-white/40 p-5 shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/55"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {locale === 'uz' ? 'Interaktiv model: Talab va taklif muvozanati' : 'Interactive Model: Supply & Demand Equilibrium'}
            </h3>
            <p className="text-xs text-muted">
              {locale === 'uz'
                ? 'Chiziq siljishi va narx shiftini o‘zgartirib muvozanat nuqtasini kuzating.'
                : 'Adjust demand/supply shifts and price ceilings to observe equilibrium and shortage.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDemandShift(0);
              setSupplyShift(0);
              setPriceCeiling(10);
            }}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === 'uz' ? 'Tiklash' : 'Reset'}</span>
          </button>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <svg viewBox="0 0 400 230" className="w-full rounded-lg border border-line bg-canvas" role="img" aria-label="Supply and demand coordinate chart">
              {/* Grid lines */}
              {[2, 4, 6, 8].map((p) => (
                <line key={p} x1="44" y1={toSvgY(p)} x2="372" y2={toSvgY(p)} stroke="var(--econova-elevated)" strokeWidth="1" />
              ))}
              {/* Axes */}
              <line x1="44" y1="24" x2="44" y2="200" stroke="var(--econova-line-strong)" strokeWidth="1.5" />
              <line x1="44" y1="200" x2="372" y2="200" stroke="var(--econova-line-strong)" strokeWidth="1.5" />
              <text x="14" y="34" fill="var(--econova-muted)" fontSize="10" fontFamily="monospace">P ($)</text>
              <text x="348" y="218" fill="var(--econova-muted)" fontSize="10" fontFamily="monospace">Q</text>

              {/* Demand Curve */}
              <line
                x1={toSvgX(Math.max(0, 100 + demandShift - 95))}
                y1={toSvgY(9.5)}
                x2={toSvgX(Math.min(130, 100 + demandShift - 5))}
                y2={toSvgY(0.5)}
                stroke="var(--econova-accent)"
                strokeWidth="2.5"
              />
              <text x={toSvgX(Math.min(125, 100 + demandShift - 12))} y={toSvgY(1.1)} fill="var(--econova-accent)" fontSize="11" fontWeight="600">D</text>

              {/* Supply Curve */}
              <line
                x1={toSvgX(Math.max(0, 20 + supplyShift + 5))}
                y1={toSvgY(0.5)}
                x2={toSvgX(Math.min(130, 20 + supplyShift + 95))}
                y2={toSvgY(9.5)}
                stroke="var(--econova-teal)"
                strokeWidth="2.5"
              />
              <text x={toSvgX(Math.min(125, 20 + supplyShift + 85))} y={toSvgY(8.8)} fill="var(--econova-teal)" fontSize="11" fontWeight="600">S</text>

              {/* Price Ceiling Line */}
              {bindingCap && (
                <>
                  <line
                    x1="44"
                    y1={toSvgY(priceCeiling)}
                    x2="372"
                    y2={toSvgY(priceCeiling)}
                    stroke="var(--econova-warning)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text x="50" y={toSvgY(priceCeiling) - 5} fill="var(--econova-warning)" fontSize="10">
                    Cap ${priceCeiling.toFixed(1)}
                  </text>
                </>
              )}

              {/* Equilibrium marker */}
              <line x1="44" y1={toSvgY(pStar)} x2={toSvgX(qStar)} y2={toSvgY(pStar)} stroke="var(--econova-success)" strokeDasharray="3 3" strokeOpacity="0.6" />
              <line x1={toSvgX(qStar)} y1={toSvgY(pStar)} x2={toSvgX(qStar)} y2="200" stroke="var(--econova-success)" strokeDasharray="3 3" strokeOpacity="0.6" />
              <circle cx={toSvgX(qStar)} cy={toSvgY(pStar)} r="5.5" fill="var(--econova-success)" stroke="var(--econova-canvas)" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="flex flex-col justify-between gap-4 lg:col-span-5">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs">
                  <label htmlFor="sd-demand" className="font-medium text-ink">
                    {locale === 'uz' ? 'Talab siljishi (ΔD)' : 'Demand Shift (ΔD)'}
                  </label>
                  <span className="font-mono tabular-nums text-accent">
                    {demandShift >= 0 ? `+${demandShift}` : demandShift} {simStrings.units}
                  </span>
                </div>
                <input
                  id="sd-demand"
                  type="range"
                  min={-30}
                  max={30}
                  step={5}
                  value={demandShift}
                  onChange={(e) => setDemandShift(Number(e.target.value))}
                  className="mt-1.5 w-full accent-accent"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <label htmlFor="sd-supply" className="font-medium text-ink">
                    {locale === 'uz' ? 'Taklif siljishi (ΔS)' : 'Supply Shift (ΔS)'}
                  </label>
                  <span className="font-mono tabular-nums text-teal">
                    {supplyShift >= 0 ? `+${supplyShift}` : supplyShift} {simStrings.units}
                  </span>
                </div>
                <input
                  id="sd-supply"
                  type="range"
                  min={-30}
                  max={30}
                  step={5}
                  value={supplyShift}
                  onChange={(e) => setSupplyShift(Number(e.target.value))}
                  className="mt-1.5 w-full accent-teal"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <label htmlFor="sd-cap" className="font-medium text-ink">
                    {locale === 'uz' ? 'Narx shifti (Cheklov)' : 'Price Ceiling Control'}
                  </label>
                  <span className="font-mono tabular-nums text-warning">
                    {priceCeiling >= 10 ? (locale === 'uz' ? 'Erkin bozor' : 'None (Free Market)') : `$${priceCeiling.toFixed(1)}`}
                  </span>
                </div>
                <input
                  id="sd-cap"
                  type="range"
                  min={1.5}
                  max={10}
                  step={0.5}
                  value={priceCeiling}
                  onChange={(e) => setPriceCeiling(Number(e.target.value))}
                  className="mt-1.5 w-full accent-warning"
                />
              </div>
            </div>

            <div className="rounded-lg border-2 border-slate-500 bg-white/50 p-3 text-xs backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted">{locale === 'uz' ? 'Muvozanat P*' : 'Equilibrium P*'}</span>
                  <div className="font-mono text-sm font-semibold tabular-nums text-success">${pStar.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted">{locale === 'uz' ? 'Muvozanat Q*' : 'Equilibrium Q*'}</span>
                  <div className="font-mono text-sm font-semibold tabular-nums text-ink">{qStar.toFixed(0)} {simStrings.units}</div>
                </div>
              </div>
              <div className="mt-2 border-t border-line pt-2 font-medium">
                {bindingCap ? (
                  <span className="text-warning">
                    {locale === 'uz'
                      ? `TAQCHILLIK: ${shortage.toFixed(0)} birlik (Qd=${qdAtActive.toFixed(0)} > Qs=${qsAtActive.toFixed(0)})`
                      : `SHORTAGE: ${shortage.toFixed(0)} units (Qd=${qdAtActive.toFixed(0)} > Qs=${qsAtActive.toFixed(0)})`}
                  </span>
                ) : (
                  <span className="text-success">
                    {locale === 'uz' ? 'BOZOR MUVOZANATDA (Qd = Qs)' : 'MARKET CLEARING (Qd = Qs)'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (type === 'calculus_derivative') {
    // f(x) = -0.25x^2 + 5x + 10 ; f'(x) = -0.5x + 5 ; peak at x=10, f(10)=35
    const f = (x: number) => -0.25 * x * x + 5 * x + 10;
    const fp = (x: number) => -0.5 * x + 5;
    const yVal = f(evalX);
    const slope = fp(evalX);

    const toSvgX = (x: number) => 42 + (x / 20) * 320;
    const toSvgY = (y: number) => 198 - (y / 42) * 165;

    const points: string[] = [];
    for (let x = 0; x <= 20; x += 0.5) {
      points.push(`${toSvgX(x).toFixed(1)},${toSvgY(f(x)).toFixed(1)}`);
    }

    const x1 = Math.max(0, evalX - 4);
    const x2 = Math.min(20, evalX + 4);
    const y1 = yVal + slope * (x1 - evalX);
    const y2 = yVal + slope * (x2 - evalX);

    return (
      <section
        aria-label={locale === 'uz' ? 'Interaktiv urinma va hosila modeli' : 'Interactive Derivative Tangent Explorer'}
        className="rounded-xl border-2 border-slate-500 bg-white/40 p-5 shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/55"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {locale === 'uz' ? 'Interaktiv model: f(x) = -0.25x² + 5x + 10 urinma qiyaligi' : 'Interactive Model: Tangent Slope f(x) = -0.25x² + 5x + 10'}
            </h3>
            <p className="text-xs text-muted">
              {locale === 'uz' ? 'x nuqtasini siljitib hosila nolga teng bo‘lgan maksimum nuqtani toping.' : 'Slide x to inspect instantaneous marginal rate f\'(x) and locate the peak where f\'(x) = 0.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEvalX(6)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === 'uz' ? 'Tiklash' : 'Reset'}</span>
          </button>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <svg viewBox="0 0 400 225" className="w-full rounded-lg border border-line bg-canvas" role="img" aria-label="Quadratic function and tangent line graph">
              <line x1="42" y1="20" x2="42" y2="198" stroke="var(--econova-line-strong)" strokeWidth="1.5" />
              <line x1="42" y1="198" x2="370" y2="198" stroke="var(--econova-line-strong)" strokeWidth="1.5" />
              <polyline fill="none" stroke="var(--econova-accent)" strokeWidth="2.5" points={points.join(' ')} />
              <line
                x1={toSvgX(x1)}
                y1={toSvgY(y1)}
                x2={toSvgX(x2)}
                y2={toSvgY(y2)}
                stroke="var(--econova-teal)"
                strokeWidth="2"
              />
              <circle cx={toSvgX(evalX)} cy={toSvgY(yVal)} r="5.5" fill="var(--econova-success)" stroke="var(--econova-canvas)" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="flex flex-col justify-between gap-4 lg:col-span-5">
            <div>
              <div className="flex justify-between text-xs">
                <label htmlFor="calc-x" className="font-medium text-ink">
                  {locale === 'uz' ? 'Nuqta (x)' : 'Evaluation Point (x)'}
                </label>
                <span className="font-mono tabular-nums text-accent">x = {evalX.toFixed(1)}</span>
              </div>
              <input
                id="calc-x"
                type="range"
                min={1}
                max={19}
                step={0.5}
                value={evalX}
                onChange={(e) => setEvalX(Number(e.target.value))}
                className="mt-2 w-full accent-accent"
              />
            </div>

            <div className="rounded-lg border-2 border-slate-500 bg-white/50 p-3 text-xs backdrop-blur-md space-y-2 dark:border-[#222B3D] dark:bg-[#080B14]/60">
              <div className="flex justify-between">
                <span className="text-muted">f(x)</span>
                <span className="font-mono font-semibold tabular-nums text-ink">{yVal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">f&apos;(x) = -0.5x + 5</span>
                <span className="font-mono font-semibold tabular-nums text-teal">{slope.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">f&apos;&apos;(x)</span>
                <span className="font-mono tabular-nums text-muted">{simStrings.concaveDown}</span>
              </div>
              <div className="border-t border-line pt-2 font-medium">
                {Math.abs(slope) < 0.01 ? (
                  <span className="text-success">{simStrings.optimalPeak}</span>
                ) : slope > 0 ? (
                  <span className="text-teal">{simStrings.marginalGain}</span>
                ) : (
                  <span className="text-warning">{simStrings.marginalDecline}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Unit Economics Simulator
  const monthlyContribution = arpa * (marginPct / 100);
  const ltv = monthlyContribution / (churnPct / 100);
  const ltvCacRatio = ltv / cac;
  const paybackMonths = cac / monthlyContribution;

  return (
    <section
      aria-label={locale === 'uz' ? 'Interaktiv unit-iqtisodiyot modeli' : 'Interactive Unit Economics Modeler'}
      className="rounded-xl border-2 border-slate-500 bg-white/40 p-5 shadow-brutal-sm backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/55"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {locale === 'uz' ? 'Interaktiv model: LTV, CAC va qoplanish muddati' : 'Interactive Model: LTV, CAC & Payback Sensitivity'}
          </h3>
          <p className="text-xs text-muted">
            {locale === 'uz' ? 'Shartli ko‘rsatkichlar bilan marja va churn ta’sirini tekshiring.' : 'Hypothetical inputs: inspect how margin and churn reshape unit sustainability.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setArpa(60);
            setMarginPct(75);
            setChurnPct(5);
            setCac(270);
          }}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{locale === 'uz' ? 'Tiklash' : 'Reset'}</span>
        </button>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs">
              <label htmlFor="ue-arpa" className="text-ink">{simStrings.monthlyArpa}</label>
              <span className="font-mono tabular-nums text-teal">${arpa}</span>
            </div>
            <input id="ue-arpa" type="range" min={20} max={150} step={5} value={arpa} onChange={(e) => setArpa(Number(e.target.value))} className="mt-1 w-full accent-teal" />
          </div>
          <div>
            <div className="flex justify-between text-xs">
              <label htmlFor="ue-margin" className="text-ink">{simStrings.grossMargin}</label>
              <span className="font-mono tabular-nums text-accent">{marginPct}%</span>
            </div>
            <input id="ue-margin" type="range" min={30} max={90} step={5} value={marginPct} onChange={(e) => setMarginPct(Number(e.target.value))} className="mt-1 w-full accent-accent" />
          </div>
          <div>
            <div className="flex justify-between text-xs">
              <label htmlFor="ue-churn" className="text-ink">{simStrings.monthlyChurn}</label>
              <span className="font-mono tabular-nums text-warning">{churnPct}%</span>
            </div>
            <input id="ue-churn" type="range" min={2} max={15} step={1} value={churnPct} onChange={(e) => setChurnPct(Number(e.target.value))} className="mt-1 w-full accent-warning" />
          </div>
          <div>
            <div className="flex justify-between text-xs">
              <label htmlFor="ue-cac" className="text-ink">{simStrings.cacLabel}</label>
              <span className="font-mono tabular-nums text-ink">${cac}</span>
            </div>
            <input id="ue-cac" type="range" min={100} max={800} step={10} value={cac} onChange={(e) => setCac(Number(e.target.value))} className="mt-1 w-full accent-accent" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border-2 border-slate-500 bg-white/50 p-4 backdrop-blur-md dark:border-[#222B3D] dark:bg-[#080B14]/60">
          <div>
            <span className="text-xs text-muted">{simStrings.monthlyGrossProfit}</span>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-ink">${monthlyContribution.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-xs text-muted">{simStrings.customerLtv}</span>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-teal">${ltv.toFixed(0)}</div>
          </div>
          <div>
            <span className="text-xs text-muted">{simStrings.ltvCacRatio}</span>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-accent">{ltvCacRatio.toFixed(2)}x</div>
          </div>
          <div>
            <span className="text-xs text-muted">{simStrings.cacPayback}</span>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-warning">{paybackMonths.toFixed(1)} {simStrings.monthsAbbr}</div>
          </div>
          <div className="col-span-2 border-t border-line pt-2 text-xs font-medium">
            {ltvCacRatio >= 3 ? (
              <span className="text-success">{simStrings.durableUnitEconomics}</span>
            ) : ltvCacRatio >= 1.5 ? (
              <span className="text-warning">{simStrings.watchMarginPayback}</span>
            ) : (
              <span className="text-danger">{simStrings.capitalEfficiencyRisk}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
