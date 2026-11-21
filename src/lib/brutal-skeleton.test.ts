import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

test('BrutalSkeleton primitives module exists and exports expected components', async () => {
  const skeletonModule = await import('../components/ui/BrutalSkeleton');
  assert.ok(typeof skeletonModule.SkeletonLine === 'function');
  assert.ok(typeof skeletonModule.SkeletonBlock === 'function');
  assert.ok(typeof skeletonModule.ContentReveal === 'function');
  assert.ok(typeof skeletonModule.BrutalCardSkeleton === 'function');
  assert.ok(typeof skeletonModule.BrutalPanelSkeleton === 'function');
  assert.ok(typeof skeletonModule.BrutalCourseDetailSkeleton === 'function');
  assert.ok(typeof skeletonModule.BrutalLessonContentSkeleton === 'function');
  assert.ok(typeof skeletonModule.BrutalLeaderboardSkeleton === 'function');
  assert.ok(typeof skeletonModule.BrutalBookmarkSkeleton === 'function');
  assert.ok(typeof skeletonModule.AdminMetricSkeleton === 'function');
  assert.ok(typeof skeletonModule.AdminCardSkeleton === 'function');
  assert.ok(typeof skeletonModule.AdminTableSkeleton === 'function');
});

test('src/index.css contains shimmer tokens and reduced-motion guardrails', () => {
  const cssPath = join(process.cwd(), 'src', 'index.css');
  assert.ok(existsSync(cssPath), 'src/index.css must exist');
  const css = readFileSync(cssPath, 'utf8');

  // Verify tokens
  assert.ok(css.includes('--skeleton-base:'), 'Must include --skeleton-base token');
  assert.ok(css.includes('--skeleton-highlight:'), 'Must include --skeleton-highlight token');
  assert.ok(css.includes('--admin-skeleton-base:'), 'Must include --admin-skeleton-base token');
  assert.ok(css.includes('--admin-skeleton-highlight:'), 'Must include --admin-skeleton-highlight token');

  // Verify keyframes and animation classes
  assert.ok(css.includes('@keyframes econova-shimmer'), 'Must include econova-shimmer keyframe');
  assert.ok(css.includes('@keyframes econova-content-reveal'), 'Must include econova-content-reveal keyframe');
  assert.ok(css.includes('.animate-shimmer'), 'Must include .animate-shimmer utility');
  assert.ok(css.includes('.animate-shimmer-admin'), 'Must include .animate-shimmer-admin utility');
  assert.ok(css.includes('.animate-content-reveal'), 'Must include .animate-content-reveal utility');

  // Verify prefers-reduced-motion overrides
  assert.ok(css.includes('prefers-reduced-motion: reduce'), 'Must handle prefers-reduced-motion');
});

test('BrutalSkeleton components have aria-busy="true" and no role="status" inline', () => {
  const filePath = join(process.cwd(), 'src', 'components', 'ui', 'BrutalSkeleton.tsx');
  const content = readFileSync(filePath, 'utf8');

  assert.ok(content.includes('aria-busy="true"'), 'Containers must declare aria-busy="true"');
  assert.ok(!content.includes('role="status"'), 'Must NOT declare inline role="status"');
  assert.ok(!content.includes('role="alert"'), 'Must NOT declare inline role="alert"');
});

test('No src/components/learn/ directory was created', () => {
  const learnDir = join(process.cwd(), 'src', 'components', 'learn');
  assert.strictEqual(existsSync(learnDir), false, 'src/components/learn/ must NOT exist');
});
