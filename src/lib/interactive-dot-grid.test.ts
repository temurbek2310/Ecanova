import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

test('InteractiveDotGrid component exists and exports React component', async () => {
  const dotGridModule = await import('../components/ui/InteractiveDotGrid');
  assert.ok(typeof dotGridModule.InteractiveDotGrid === 'function');
});

test('InteractiveDotGrid renders canvas with exact data attributes, aria-hidden and print:hidden', () => {
  const filePath = join(process.cwd(), 'src', 'components', 'ui', 'InteractiveDotGrid.tsx');
  assert.ok(existsSync(filePath), 'src/components/ui/InteractiveDotGrid.tsx must exist');
  const content = readFileSync(filePath, 'utf8');

  assert.ok(content.includes('data-dot-grid="true"'), 'Canvas must declare data-dot-grid="true"');
  assert.ok(content.includes('aria-hidden="true"'), 'Canvas must declare aria-hidden="true"');
  assert.ok(content.includes('print:hidden'), 'Canvas must declare print:hidden');
  assert.ok(content.includes('pointer-events-none'), 'Canvas must declare pointer-events-none');
  assert.ok(content.includes('absolute inset-0'), 'Canvas must declare absolute inset-0');
  assert.ok(content.includes('z-0'), 'Canvas must declare z-0');
});

test('Exact selected dot grid configuration defaults are enforced', () => {
  const filePath = join(process.cwd(), 'src', 'components', 'ui', 'InteractiveDotGrid.tsx');
  const content = readFileSync(filePath, 'utf8');

  assert.ok(content.includes('spacing = 20'), 'Default spacing must be 20px');
  assert.ok(content.includes('baseRadius = 1.4'), 'Default baseRadius must be 1.4px');
  assert.ok(content.includes('cursorRadius = 115'), 'Default cursorRadius must be 115px');
  assert.ok(content.includes('intensity = 70'), 'Default intensity must be 70');
  assert.ok(content.includes("accentColor = '#F59E0B'"), "Default accentColor must be Amber '#F59E0B'");
  assert.ok(content.includes('glow = true'), 'Default glow must be true');
  assert.ok(content.includes('scale = true'), 'Default scale must be true');
  assert.ok(content.includes('wave = true'), 'Default wave must be true');
  assert.ok(content.includes('repel = false'), 'Default repel must be false');
  assert.ok(content.includes('parallax = false'), 'Default parallax must be false');
});

test('Single shared singleton engine manages canvas lifecycle and reduced-motion guardrails', () => {
  const filePath = join(process.cwd(), 'src', 'components', 'ui', 'InteractiveDotGrid.tsx');
  const content = readFileSync(filePath, 'utf8');

  assert.ok(content.includes('DotGridSingletonEngine'), 'Singleton engine class must exist');
  assert.ok(content.includes('IntersectionObserver'), 'IntersectionObserver must be used for pausing off-screen canvases');
  assert.ok(content.includes('ResizeObserver'), 'ResizeObserver must be used for dynamic canvas resizing');
  assert.ok(content.includes('prefers-reduced-motion: reduce'), 'prefers-reduced-motion must be checked');
  assert.ok(content.includes('renderEntryStatic'), 'Static single-frame render must exist for reduced motion');
  assert.ok(content.includes('clearRect'), 'Must use clearRect for transparent canvas overlay to preserve backdrop blur');
});

test('Lab dots playground is completely removed', () => {
  const labPath = join(process.cwd(), 'src', 'components', 'lab');
  assert.equal(existsSync(labPath), false, 'src/components/lab must be deleted');

  const appPath = join(process.cwd(), 'src', 'App.tsx');
  const appContent = readFileSync(appPath, 'utf8');
  assert.equal(appContent.includes('DotGridLabPage'), false, 'App.tsx must not import DotGridLabPage');
  assert.equal(appContent.includes('lab-dots'), false, 'App.tsx must not reference lab-dots');

  const routingPath = join(process.cwd(), 'src', 'lib', 'auth-routing.ts');
  const routingContent = readFileSync(routingPath, 'utf8');
  assert.equal(routingContent.includes('lab-dots'), false, 'auth-routing.ts must not contain lab-dots');
  assert.equal(routingContent.includes('/lab/dots'), false, 'auth-routing.ts must not contain /lab/dots');
});

test('Forbidden scopes and banners are respected', () => {
  assert.equal(existsSync(join(process.cwd(), 'src', 'components', 'learn')), false, 'src/components/learn/ must not exist');
});

test('Light mode contrast boosting preserves Dark mode parity and provides high contrast in Light mode', async () => {
  const { resolveDotGridColors } = await import('../components/ui/InteractiveDotGrid');
  const { resolveWatermarkAccent } = await import('../components/FloatingWatermark');
  const { resolveSubjectArtifactLightAccent } = await import('../components/SubjectArtifactSvg');

  // Dark Mode parity: 100% identical
  const darkGrid = resolveDotGridColors(true, '#F59E0B');
  assert.deepEqual(darkGrid.baseRgb, [148, 163, 184]);
  assert.equal(darkGrid.baseAlpha, 0.16);
  assert.equal(darkGrid.staticColor, 'rgba(148, 163, 184, 0.16)');
  assert.deepEqual(darkGrid.accentRgb, [245, 158, 11]);
  assert.equal(darkGrid.maxHoverAlpha, 0.92);

  assert.equal(resolveWatermarkAccent('#5DE1D2', true), '#5DE1D2');
  assert.equal(resolveWatermarkAccent('#9274FF', true), '#9274FF');
  assert.equal(resolveWatermarkAccent('#6FE0A1', true), '#6FE0A1');
  assert.equal(resolveWatermarkAccent('#FFC96B', true), '#FFC96B');

  // Light Mode: Subtle Slate-600 resting dots + Rich Amber (#C2610C) glow on hover
  const lightGrid = resolveDotGridColors(false, '#F59E0B');
  assert.deepEqual(lightGrid.baseRgb, [71, 85, 105]); // Slate-600 (#475569)
  assert.equal(lightGrid.baseAlpha, 0.18); // ~0.16–0.20
  assert.equal(lightGrid.staticColor, 'rgba(71, 85, 105, 0.18)');
  assert.deepEqual(lightGrid.accentRgb, [194, 97, 12]); // Rich Amber #C2610C
  assert.equal(lightGrid.maxHoverAlpha, 0.76); // ~0.74–0.80
  assert.equal(lightGrid.rippleBlendFactor, 0.22);

  // Watermark Light mode deep contrast accents
  assert.equal(resolveWatermarkAccent('#5DE1D2', false), '#0F766E');
  assert.equal(resolveWatermarkAccent('#9274FF', false), '#5B21B6');
  assert.equal(resolveWatermarkAccent('#6FE0A1', false), '#047857');
  assert.equal(resolveWatermarkAccent('#FFC96B', false), '#B45309');

  // Artifact SVG Light mode deep contrast accents
  assert.equal(resolveSubjectArtifactLightAccent('#5DE1D2'), '#0F766E');
  assert.equal(resolveSubjectArtifactLightAccent('#9274FF'), '#5B21B6');
  assert.equal(resolveSubjectArtifactLightAccent('#6FE0A1'), '#047857');
  assert.equal(resolveSubjectArtifactLightAccent('#FFC96B'), '#B45309');
});
