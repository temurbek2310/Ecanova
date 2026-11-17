import type { LocaleCode } from '../shared/types';
import type { ThemeMode } from './theme';

export interface ChalkStrokeSpec {
  id: string;
  role: 'axis' | 'curve' | 'tangent' | 'annotation' | 'geometry' | 'underline';
  d: string;
  color: string;
  strokeClassName: string;
  strokeWidth: number;
  fallbackLength: number;
  duration: number;
  delay: number;
  dashedAfterDraw?: string;
}

export interface MathDiagramBlueprint {
  id: string;
  title: string;
  formulaLatex: string;
  caption: string;
  viewBox: string;
  strokes: ChalkStrokeSpec[];
}

export interface StrokeDrawState {
  strokeDasharray: string;
  strokeDashoffset: number;
}

export interface MathGrainOverlayProps {
  mixBlendClass: 'mix-blend-screen' | 'mix-blend-multiply';
  opacityClass: string;
  blendMode: 'screen' | 'multiply';
}

/**
 * Programmatically resolves the CSS grain/noise overlay blend mode and opacity
 * depending on whether the active theme is dark (`mix-blend-screen`) or light (`mix-blend-multiply`).
 */
export function resolveMathGrainOverlayProps(theme: ThemeMode): MathGrainOverlayProps {
  if (theme === 'light') {
    return {
      mixBlendClass: 'mix-blend-multiply',
      opacityClass: 'opacity-20',
      blendMode: 'multiply',
    };
  }
  return {
    mixBlendClass: 'mix-blend-screen',
    opacityClass: 'opacity-30',
    blendMode: 'screen',
  };
}

/**
 * Computes deterministic SVG stroke-dasharray and stroke-dashoffset values
 * for DrawSVG-style progressive chalk path animation.
 */
export function computeChalkStrokeDrawState(
  totalLength: number,
  progress: number
): StrokeDrawState {
  const safeLength = Math.max(1, Number.isFinite(totalLength) ? totalLength : 100);
  const clampedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const offset = Number((safeLength * (1 - clampedProgress)).toFixed(2));
  return {
    strokeDasharray: `${safeLength.toFixed(2)} ${safeLength.toFixed(2)}`,
    strokeDashoffset: offset,
  };
}

/**
 * Returns the chalkboard SVG diagram blueprints ("Precision & The Human Touch")
 * for the Mathematics section in English or Uzbek.
 * Uses CSS variables (`var(--econova-*)`) and `stroke-current` semantic classes so
 * paths dynamically inherit high-contrast theme colors in both dark and light modes.
 */
export function buildMathematicsChalkBlueprints(locale: LocaleCode): MathDiagramBlueprint[] {
  const isUz = locale === 'uz';

  return [
    {
      id: 'derivative-tangent',
      title: isUz ? 'Hosilaning geometrik ma’nosi' : 'Derivative & Instantaneous Slope',
      formulaLatex: "f'(x₀) = lim_{h→0} [f(x₀ + h) - f(x₀)] / h",
      caption: isUz
        ? 'Urinma chiziq burchak koeffitsienti marjinal o‘zgarish tezligini ifodalaydi.'
        : 'Chalk tangent line touching the concave utility curve at optimal allocation x₀.',
      viewBox: '0 0 320 190',
      strokes: [
        {
          id: 'deriv-axes',
          role: 'axis',
          d: 'M 34 162 L 296 162 M 38 166 L 38 20',
          color: 'var(--econova-muted)',
          strokeClassName: 'text-theme-muted stroke-current',
          strokeWidth: 2,
          fallbackLength: 410,
          duration: 0.55,
          delay: 0,
        },
        {
          id: 'deriv-curve',
          role: 'curve',
          d: 'M 44 150 C 92 142, 132 58, 212 44 C 246 38, 272 46, 290 58',
          color: 'var(--econova-teal)',
          strokeClassName: 'text-theme-cyan stroke-current',
          strokeWidth: 2.75,
          fallbackLength: 290,
          duration: 0.75,
          delay: 0.2,
        },
        {
          id: 'deriv-tangent',
          role: 'tangent',
          d: 'M 72 134 L 244 26',
          color: 'var(--econova-warning)',
          strokeClassName: 'text-theme-amber stroke-current',
          strokeWidth: 2.25,
          fallbackLength: 210,
          duration: 0.6,
          delay: 0.55,
        },
        {
          id: 'deriv-drop-lines',
          role: 'geometry',
          d: 'M 158 80 L 158 162 M 38 80 L 158 80',
          color: 'var(--econova-accent)',
          strokeClassName: 'text-theme-accent stroke-current',
          strokeWidth: 1.75,
          fallbackLength: 210,
          duration: 0.5,
          delay: 0.75,
        },
        {
          id: 'deriv-arrow-scribble',
          role: 'annotation',
          d: 'M 218 98 C 198 96, 182 90, 168 83 M 176 80 L 166 82 L 173 91',
          color: 'var(--econova-success)',
          strokeClassName: 'text-theme-emerald stroke-current',
          strokeWidth: 2,
          fallbackLength: 85,
          duration: 0.45,
          delay: 0.95,
        },
      ],
    },
    {
      id: 'riemann-integral',
      title: isUz ? 'Aniq integral va iste’molchi yutug‘i' : 'Definite Integral & Area Accumulation',
      formulaLatex: '∫_a^b f(x) dx = F(b) - F(a)',
      caption: isUz
        ? 'Egri chiziq ostidagi yuzani elementar ustunlar yig‘indisi sifatida baholash.'
        : 'Hand-drawn Riemann partitions approximating continuous surplus accumulation.',
      viewBox: '0 0 320 190',
      strokes: [
        {
          id: 'int-axes',
          role: 'axis',
          d: 'M 34 162 L 296 162 M 38 166 L 38 22',
          color: 'var(--econova-muted)',
          strokeClassName: 'text-theme-muted stroke-current',
          strokeWidth: 2,
          fallbackLength: 410,
          duration: 0.55,
          delay: 0.05,
        },
        {
          id: 'int-partitions',
          role: 'geometry',
          d: 'M 76 162 L 76 108 L 116 108 L 116 162 M 116 82 L 156 82 L 156 162 M 156 64 L 196 64 L 196 162 M 196 58 L 236 58 L 236 162',
          color: 'var(--econova-accent)',
          strokeClassName: 'text-theme-accent stroke-current',
          strokeWidth: 1.85,
          fallbackLength: 560,
          duration: 0.85,
          delay: 0.25,
        },
        {
          id: 'int-wave',
          role: 'curve',
          d: 'M 48 136 Q 108 78, 176 60 T 284 48',
          color: 'var(--econova-success)',
          strokeClassName: 'text-theme-emerald stroke-current',
          strokeWidth: 2.75,
          fallbackLength: 270,
          duration: 0.7,
          delay: 0.6,
        },
        {
          id: 'int-scribble-brace',
          role: 'underline',
          d: 'M 76 174 C 118 182, 194 182, 236 174',
          color: 'var(--econova-warning)',
          strokeClassName: 'text-theme-amber stroke-current',
          strokeWidth: 2,
          fallbackLength: 170,
          duration: 0.45,
          delay: 0.9,
        },
      ],
    },
    {
      id: 'lagrange-simplex',
      title: isUz ? 'Chiziqli algebra va optimallashtirish' : 'Vector Projection & Constrained Optima',
      formulaLatex: '∇f(x*) = λ ∇g(x*)',
      caption: isUz
        ? 'Cheklov tekisligiga ortogonal proyeksiyalangan gradiyent vektorlari.'
        : 'Orthogonal projection and gradient alignment on a feasible simplex boundary.',
      viewBox: '0 0 320 190',
      strokes: [
        {
          id: 'vec-triangle',
          role: 'geometry',
          d: 'M 56 152 L 266 152 L 178 36 Z',
          color: 'var(--econova-muted)',
          strokeClassName: 'text-theme-muted stroke-current',
          strokeWidth: 2,
          fallbackLength: 540,
          duration: 0.7,
          delay: 0.1,
        },
        {
          id: 'vec-contour-arcs',
          role: 'curve',
          d: 'M 112 132 A 64 64 0 0 1 206 76 M 94 144 A 88 88 0 0 1 224 62',
          color: 'var(--econova-teal)',
          strokeClassName: 'text-theme-cyan stroke-current',
          strokeWidth: 2,
          fallbackLength: 290,
          duration: 0.65,
          delay: 0.4,
        },
        {
          id: 'vec-gradient-arrow',
          role: 'tangent',
          d: 'M 152 152 L 214 82 M 201 84 L 215 81 L 212 95',
          color: 'var(--econova-warning)',
          strokeClassName: 'text-theme-amber stroke-current',
          strokeWidth: 2.5,
          fallbackLength: 130,
          duration: 0.55,
          delay: 0.7,
        },
        {
          id: 'vec-right-angle',
          role: 'annotation',
          d: 'M 204 93 L 195 85 L 203 76',
          color: 'var(--econova-accent)',
          strokeClassName: 'text-theme-accent stroke-current',
          strokeWidth: 2,
          fallbackLength: 45,
          duration: 0.35,
          delay: 0.95,
        },
      ],
    },
  ];
}
