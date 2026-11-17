import type { Config } from 'tailwindcss';

/**
 * ECONOVA Theme Palette Configuration
 * Semantic color tokens map to CSS custom properties in src/index.css
 * for Dark Mode (default) and High-Contrast Light Mode (.light).
 */
export const econovaThemePalettes = {
  dark: {
    canvas: '#080B14',
    chrome: '#0B0F19',
    surface: '#101522',
    elevated: '#141B2B',
    line: '#222B3D',
    lineStrong: '#33415C',
    ink: '#F3F6FF',
    muted: '#8994AA',
    accent: '#9274FF',
    accentHover: '#A68DFF',
    accentInk: '#080B14',
    teal: '#5DE1D2',
    tealHover: '#7CEBE0',
    tealInk: '#080B14',
    success: '#6FE0A1',
    warning: '#FFC96B',
    danger: '#FB7185',
    dangerSurface: '#4C0519',
    dangerText: '#FECDD3',
  },
  light: {
    canvas: '#F8FAFC',
    chrome: '#FFFFFF',
    surface: '#FFFFFF',
    elevated: '#E2E8F0',
    line: '#94A3B8',
    lineStrong: '#475569',
    ink: '#090D16',
    muted: '#334155',
    accent: '#5B21B6',
    accentHover: '#4C1D95',
    accentInk: '#FFFFFF',
    teal: '#0F766E',
    tealHover: '#115E59',
    tealInk: '#FFFFFF',
    success: '#047857',
    warning: '#92400E',
    danger: '#B91C1C',
    dangerSurface: '#FEE2E2',
    dangerText: '#7F1D1D',
  },
} as const;

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'color-mix(in srgb, var(--econova-canvas) calc(<alpha-value> * 100%), transparent)',
        chrome: 'color-mix(in srgb, var(--econova-chrome) calc(<alpha-value> * 100%), transparent)',
        surface: 'color-mix(in srgb, var(--econova-surface) calc(<alpha-value> * 100%), transparent)',
        elevated: 'color-mix(in srgb, var(--econova-elevated) calc(<alpha-value> * 100%), transparent)',
        line: 'color-mix(in srgb, var(--econova-line) calc(<alpha-value> * 100%), transparent)',
        'line-strong': 'color-mix(in srgb, var(--econova-line-strong) calc(<alpha-value> * 100%), transparent)',
        ink: 'color-mix(in srgb, var(--econova-ink) calc(<alpha-value> * 100%), transparent)',
        muted: 'color-mix(in srgb, var(--econova-muted) calc(<alpha-value> * 100%), transparent)',
        accent: 'color-mix(in srgb, var(--econova-accent) calc(<alpha-value> * 100%), transparent)',
        'accent-hover': 'color-mix(in srgb, var(--econova-accent-hover) calc(<alpha-value> * 100%), transparent)',
        'accent-ink': 'color-mix(in srgb, var(--econova-accent-ink) calc(<alpha-value> * 100%), transparent)',
        teal: 'color-mix(in srgb, var(--econova-teal) calc(<alpha-value> * 100%), transparent)',
        'teal-hover': 'color-mix(in srgb, var(--econova-teal-hover) calc(<alpha-value> * 100%), transparent)',
        'teal-ink': 'color-mix(in srgb, var(--econova-teal-ink) calc(<alpha-value> * 100%), transparent)',
        success: 'color-mix(in srgb, var(--econova-success) calc(<alpha-value> * 100%), transparent)',
        warning: 'color-mix(in srgb, var(--econova-warning) calc(<alpha-value> * 100%), transparent)',
        danger: 'color-mix(in srgb, var(--econova-danger) calc(<alpha-value> * 100%), transparent)',
        'danger-surface': 'color-mix(in srgb, var(--econova-danger-surface) calc(<alpha-value> * 100%), transparent)',
        'danger-text': 'color-mix(in srgb, var(--econova-danger-text) calc(<alpha-value> * 100%), transparent)',

        'theme-base': 'color-mix(in srgb, var(--econova-canvas) calc(<alpha-value> * 100%), transparent)',
        'theme-chrome': 'color-mix(in srgb, var(--econova-chrome) calc(<alpha-value> * 100%), transparent)',
        'theme-panel': 'color-mix(in srgb, var(--econova-surface) calc(<alpha-value> * 100%), transparent)',
        'theme-elevated': 'color-mix(in srgb, var(--econova-elevated) calc(<alpha-value> * 100%), transparent)',
        'theme-border': 'color-mix(in srgb, var(--econova-line) calc(<alpha-value> * 100%), transparent)',
        'theme-border-strong': 'color-mix(in srgb, var(--econova-line-strong) calc(<alpha-value> * 100%), transparent)',
        'theme-ink': 'color-mix(in srgb, var(--econova-ink) calc(<alpha-value> * 100%), transparent)',
        'theme-muted': 'color-mix(in srgb, var(--econova-muted) calc(<alpha-value> * 100%), transparent)',
        'theme-accent': 'color-mix(in srgb, var(--econova-accent) calc(<alpha-value> * 100%), transparent)',
        'theme-accent-hover': 'color-mix(in srgb, var(--econova-accent-hover) calc(<alpha-value> * 100%), transparent)',
        'theme-accent-ink': 'color-mix(in srgb, var(--econova-accent-ink) calc(<alpha-value> * 100%), transparent)',
        'theme-cyan': 'color-mix(in srgb, var(--econova-teal) calc(<alpha-value> * 100%), transparent)',
        'theme-emerald': 'color-mix(in srgb, var(--econova-success) calc(<alpha-value> * 100%), transparent)',
        'theme-amber': 'color-mix(in srgb, var(--econova-warning) calc(<alpha-value> * 100%), transparent)',
      },
      boxShadow: {
        brutal: '4px 4px 0px 0px var(--econova-shadow-color)',
        'brutal-lg': '8px 8px 0px 0px var(--econova-shadow-color)',
        'brutal-sm': '3px 3px 0px 0px var(--econova-shadow-color)',
        'brutal-accent': '4px 4px 0px 0px var(--econova-shadow-accent)',
      },
    },
  },
};

export default config;
