import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFloatingWatermarkParticles,
  computeResponsiveParticleCount,
  FLOATING_WATERMARK_DICTIONARY,
  resolveFloatingWatermarkTheme,
  resolveWatermarkParallaxConfig,
  resolveWatermarkScrollTriggerConfig,
  shouldApplyRafParallaxFrame,
  shouldEnableWatermarkMotion,
  shouldPauseWatermarkOnMobile,
} from './floating-watermark';

test('resolveFloatingWatermarkTheme maps context themes and aliases cleanly', () => {
  assert.equal(resolveFloatingWatermarkTheme('sidebar'), 'sidebar');
  assert.equal(resolveFloatingWatermarkTheme('gamification'), 'gamification');
  assert.equal(resolveFloatingWatermarkTheme('leaderboard'), 'gamification');
  assert.equal(resolveFloatingWatermarkTheme('analytics'), 'analytics');
  assert.equal(resolveFloatingWatermarkTheme('course-mathematics'), 'course-mathematics');
  assert.equal(resolveFloatingWatermarkTheme('course-math'), 'course-mathematics');
  assert.equal(resolveFloatingWatermarkTheme('course-economics'), 'course-economics');
  assert.equal(resolveFloatingWatermarkTheme('course-business'), 'course-business');
  assert.equal(resolveFloatingWatermarkTheme('unknown-theme'), 'analytics');
});

test('FLOATING_WATERMARK_DICTIONARY provides distinct domain-strict glyphs per context', () => {
  assert.deepEqual(FLOATING_WATERMARK_DICTIONARY.sidebar.glyphs, [
    'compass',
    'cursor-pointer',
    'command-key',
    'nav-nodes',
  ]);
  assert.deepEqual(FLOATING_WATERMARK_DICTIONARY.gamification.glyphs, [
    'wireframe-star',
    'lightning-bolt',
    'isometric-cube',
    'milestone-crest',
  ]);
  assert.deepEqual(FLOATING_WATERMARK_DICTIONARY.analytics.glyphs, [
    'trendline-spark',
    'radar-grid',
    'target-crosshair',
    'bar-metrics',
  ]);
  assert.ok(FLOATING_WATERMARK_DICTIONARY['course-business'].glyphs.includes('chess-knight'));
  assert.ok(FLOATING_WATERMARK_DICTIONARY['course-economics'].glyphs.includes('candlesticks'));
  assert.ok(FLOATING_WATERMARK_DICTIONARY['course-mathematics'].glyphs.includes('icosahedron'));
});

test('buildFloatingWatermarkParticles builds 3-5 staggered subtle particles with energetic bounds', () => {
  const sidebarParticles = buildFloatingWatermarkParticles({ theme: 'sidebar' });
  assert.equal(sidebarParticles.length, 4);
  assert.ok(sidebarParticles.every((p) => p.opacityClass === 'opacity-20' || p.opacityClass === 'opacity-25'));
  assert.ok(sidebarParticles.every((p) => p.durationSec >= 2.5 && p.durationSec <= 4.5));
  assert.ok(sidebarParticles.every((p) => p.xRange[0] === -40 && p.xRange[1] === 40));
  assert.ok(sidebarParticles.every((p) => p.yRange[0] === -35 && p.yRange[1] === 35));
  assert.ok(new Set(sidebarParticles.map((p) => p.delaySec)).size >= 3);

  const analyticsParticles = buildFloatingWatermarkParticles({
    theme: 'analytics',
    seedIndex: 2,
    count: 5,
  });
  assert.equal(analyticsParticles.length, 5);
  assert.ok(analyticsParticles.some((p) => p.continuousSpin360));
  assert.ok(analyticsParticles.every((p) => p.baseScale >= 0.5 && p.baseScale <= 1.2));

  const heroRightParticles = buildFloatingWatermarkParticles({
    theme: 'analytics',
    seedIndex: 3,
    count: 5,
    layout: 'hero-right',
  });
  assert.equal(heroRightParticles.length, 5);
  assert.ok(heroRightParticles.every((p) => p.leftPercent >= 58 && p.leftPercent <= 90));

  const gamificationParticles = buildFloatingWatermarkParticles({
    theme: 'gamification',
    seedIndex: 1,
  });
  assert.equal(gamificationParticles.length, 4);
  assert.ok(
    gamificationParticles.every((p) =>
      FLOATING_WATERMARK_DICTIONARY.gamification.glyphs.includes(p.glyph)
    )
  );
});

test('shouldEnableWatermarkMotion runs unconditionally across all viewport widths and pauses only for reduced motion', () => {
  assert.equal(
    shouldEnableWatermarkMotion({
      viewportWidth: 1440,
      prefersReducedMotion: false,
      hardwareConcurrency: 8,
    }),
    true
  );

  assert.equal(
    shouldEnableWatermarkMotion({
      viewportWidth: 768,
      prefersReducedMotion: false,
      hardwareConcurrency: 2,
    }),
    true
  );

  assert.equal(
    shouldEnableWatermarkMotion({
      viewportWidth: 480,
      prefersReducedMotion: false,
    }),
    true
  );

  assert.equal(
    shouldEnableWatermarkMotion({
      viewportWidth: 479,
      prefersReducedMotion: false,
    }),
    true
  );

  assert.equal(
    shouldEnableWatermarkMotion({
      viewportWidth: 320,
      prefersReducedMotion: false,
      hardwareConcurrency: 8,
    }),
    true
  );

  assert.equal(
    shouldEnableWatermarkMotion({
      viewportWidth: 1280,
      prefersReducedMotion: true,
      hardwareConcurrency: 8,
    }),
    false
  );
});

test('resolveWatermarkScrollTriggerConfig enforces invalidateOnRefresh: true for sticky and scrollable boxes', () => {
  const stickyCfg = resolveWatermarkScrollTriggerConfig({ isSticky: true });
  assert.equal(stickyCfg.invalidateOnRefresh, true);
  assert.equal(stickyCfg.end, 'max');
  assert.equal(stickyCfg.start, 'top bottom');

  const cardCfg = resolveWatermarkScrollTriggerConfig({ isSticky: false });
  assert.equal(cardCfg.invalidateOnRefresh, true);
  assert.equal(cardCfg.end, 'bottom top');
  assert.equal(cardCfg.toggleActions, 'play pause resume pause');
});

test('resolveWatermarkParallaxConfig enables rAF throttling and scroll suppression for sidebar', () => {
  const sidebarCfg = resolveWatermarkParallaxConfig({ theme: 'sidebar' });
  assert.equal(sidebarCfg.mode, 'raf');
  assert.equal(sidebarCfg.pauseDuringScroll, true);
  assert.ok(sidebarCfg.scrollCooldownMs >= 100);
  assert.ok(sidebarCfg.minPointerDeltaPx >= 1);

  const overrideCfg = resolveWatermarkParallaxConfig({
    theme: 'sidebar',
    parallaxMode: 'immediate',
  });
  assert.equal(overrideCfg.mode, 'immediate');
});

test('shouldApplyRafParallaxFrame gates updates during scroll and sub-threshold pointer jitter', () => {
  assert.equal(
    shouldApplyRafParallaxFrame({
      isHovering: false,
      isScrolling: false,
      pendingPoint: { x: 100, y: 200 },
      lastAppliedPoint: null,
      minDeltaPx: 1.5,
    }),
    false
  );

  assert.equal(
    shouldApplyRafParallaxFrame({
      isHovering: true,
      isScrolling: true,
      pendingPoint: { x: 100, y: 200 },
      lastAppliedPoint: null,
      minDeltaPx: 1.5,
    }),
    false
  );

  assert.equal(
    shouldApplyRafParallaxFrame({
      isHovering: true,
      isScrolling: false,
      pendingPoint: { x: 100, y: 200 },
      lastAppliedPoint: null,
      minDeltaPx: 1.5,
    }),
    true
  );

  // Sub-threshold movement is skipped
  assert.equal(
    shouldApplyRafParallaxFrame({
      isHovering: true,
      isScrolling: false,
      pendingPoint: { x: 100.5, y: 200.5 },
      lastAppliedPoint: { x: 100, y: 200 },
      minDeltaPx: 1.5,
    }),
    false
  );

  // Meaningful movement passes
  assert.equal(
    shouldApplyRafParallaxFrame({
      isHovering: true,
      isScrolling: false,
      pendingPoint: { x: 104, y: 202 },
      lastAppliedPoint: { x: 100, y: 200 },
      minDeltaPx: 1.5,
    }),
    true
  );
});

test('computeResponsiveParticleCount adjusts particle count cleanly based on container width', () => {
  assert.equal(
    computeResponsiveParticleCount({ containerWidth: 220, theme: 'sidebar' }),
    2
  );
  assert.equal(
    computeResponsiveParticleCount({ containerWidth: 256, theme: 'sidebar' }),
    2
  );
  assert.equal(
    computeResponsiveParticleCount({ containerWidth: 340, theme: 'analytics' }),
    3
  );
  assert.equal(
    computeResponsiveParticleCount({ containerWidth: 620, theme: 'analytics' }),
    4
  );
  assert.equal(
    computeResponsiveParticleCount({ containerWidth: 960, theme: 'course-business' }),
    5
  );
  // Explicit count caps upper bound while still scaling down on narrow containers
  assert.equal(
    computeResponsiveParticleCount({
      containerWidth: 240,
      theme: 'analytics',
      explicitCount: 4,
    }),
    2
  );
  assert.equal(
    computeResponsiveParticleCount({
      containerWidth: 960,
      theme: 'analytics',
      explicitCount: 3,
    }),
    3
  );

  assert.equal(
    buildFloatingWatermarkParticles({ theme: 'analytics', containerWidth: 220 }).length,
    2
  );
  assert.equal(
    buildFloatingWatermarkParticles({ theme: 'analytics', containerWidth: 900 }).length,
    5
  );
});

test('shouldPauseWatermarkOnMobile does not pause based on viewport width and only pauses when hidden', () => {
  assert.equal(
    shouldPauseWatermarkOnMobile({
      theme: 'sidebar',
      viewportWidth: 390,
    }),
    false
  );
  assert.equal(
    shouldPauseWatermarkOnMobile({
      theme: 'sidebar',
      viewportWidth: 767,
    }),
    false
  );
  assert.equal(
    shouldPauseWatermarkOnMobile({
      theme: 'sidebar',
      viewportWidth: 768,
      isElementHidden: true,
    }),
    true
  );
  assert.equal(
    shouldPauseWatermarkOnMobile({
      theme: 'sidebar',
      viewportWidth: 1024,
      isElementHidden: false,
    }),
    false
  );
  assert.equal(
    shouldPauseWatermarkOnMobile({
      theme: 'sidebar',
      viewportWidth: 1440,
    }),
    false
  );
  assert.equal(
    shouldPauseWatermarkOnMobile({
      theme: 'analytics',
      viewportWidth: 320,
      isElementHidden: false,
    }),
    false
  );
});

