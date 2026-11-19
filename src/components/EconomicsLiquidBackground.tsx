'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import {
  ECONOMICS_LIQUID_FRAGMENT_SHADER,
  ECONOMICS_LIQUID_VERTEX_SHADER,
  resolveActiveEconomicsShaderPalette,
} from '../lib/economics-shader';
import {
  computeBackgroundParallaxOffset,
  DEFAULT_BG_PARALLAX_MAX_PX,
  DEFAULT_WEBGL_BASE_Z,
  DEFAULT_WEBGL_MIN_Z,
  stepViscousBackgroundScroll,
  type ViscousBackgroundScrollState,
} from '../lib/scroll-sync';
import {
  observeDocumentTheme,
  readActiveDocumentTheme,
  type ThemeMode,
} from '../lib/theme';

gsap.registerPlugin(ScrollTrigger);

interface UniformSet {
  [uniform: string]: THREE.IUniform;
  uTime: { value: number };
  uScrollY: { value: number };
  uScrollVelocity: { value: number };
  uResolution: { value: THREE.Vector2 };
  uPointer: { value: THREE.Vector2 };
  u_colorA: { value: THREE.Vector3 };
  u_colorB: { value: THREE.Vector3 };
  u_colorC: { value: THREE.Vector3 };
  uColorBase: { value: THREE.Vector3 };
  uColorCyan: { value: THREE.Vector3 };
  uColorGreen: { value: THREE.Vector3 };
}

interface EconomicsLiquidBackgroundProps {
  active?: boolean;
  theme?: ThemeMode;
  className?: string;
}

/**
 * 80% time-scale reduction for glacial, heavy, meditative shader fluid progression.
 */
export const GLACIAL_LIQUID_TIME_MULTIPLIER = 0.2;
export const GLACIAL_AMBIENT_DURATION_SEC = 24;

/**
 * Fixed Three.js WebGL "Reactive Data Topography" liquid shader background.
 * - Root container is decoupled (`fixed inset-0 -z-10 pointer-events-none`).
 * - Scroll reactivity is driven exclusively by GSAP `ScrollTrigger` (`scrub: 1.6`)
 *   and heavy viscous lerp damping (`stepViscousBackgroundScroll`), eliminating scroll jitter.
 * - Shader `uTime` runs at 0.2x (80% slower) alongside a 24-second `sine.inOut` GSAP glacial drift.
 * - Desktop (`min-width: 769px`) applies opposite-direction mouse micro-parallax (`±25px`)
 *   via `gsap.quickTo()` + `matchMedia`, automatically disabled on mobile (`max-width: 768px`).
 */
export const EconomicsLiquidBackground: React.FC<EconomicsLiquidBackgroundProps> = ({
  active = true,
  theme,
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const parallaxLayerRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const uniformsRef = useRef<UniformSet | null>(null);
  const targetColorsRef = useRef<{
    colorA: THREE.Vector3;
    colorB: THREE.Vector3;
    colorC: THREE.Vector3;
  } | null>(null);
  const renderOnceRef = useRef<(() => void) | null>(null);
  const scrollProxyRef = useRef<{
    progress: number;
    scrollY: number;
    maxScroll: number;
  }>({
    progress: 0,
    scrollY: 0,
    maxScroll: 2400,
  });

  const [detectedTheme, setDetectedTheme] = useState<ThemeMode>(() =>
    theme ?? readActiveDocumentTheme()
  );

  useEffect(() => {
    if (theme) {
      setDetectedTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDetectedTheme(theme ?? readActiveDocumentTheme());
    return observeDocumentTheme((nextTheme) => {
      setDetectedTheme(nextTheme);
    });
  }, [theme]);

  // Smoothly interpolate WebGL shader palette uniforms when theme toggles
  useEffect(() => {
    const palette = resolveActiveEconomicsShaderPalette(detectedTheme);
    const nextA = new THREE.Vector3(
      palette.baseSlateRgb.r,
      palette.baseSlateRgb.g,
      palette.baseSlateRgb.b
    );
    const nextB = new THREE.Vector3(
      palette.cyanAccentRgb.r,
      palette.cyanAccentRgb.g,
      palette.cyanAccentRgb.b
    );
    const nextC = new THREE.Vector3(
      palette.greenAccentRgb.r,
      palette.greenAccentRgb.g,
      palette.greenAccentRgb.b
    );

    targetColorsRef.current = {
      colorA: nextA,
      colorB: nextB,
      colorC: nextC,
    };

    if (rootRef.current) {
      rootRef.current.setAttribute('data-active-theme', detectedTheme);
      rootRef.current.setAttribute('data-uniform-color-a', palette.baseSlateHex);
      rootRef.current.setAttribute('data-uniform-color-b', palette.cyanAccentHex);
      rootRef.current.setAttribute('data-uniform-color-c', palette.greenAccentHex);
    }

    const uniforms = uniformsRef.current;
    if (!uniforms) return;

    let rafId = 0;
    const startA = uniforms.u_colorA.value.clone();
    const startB = uniforms.u_colorB.value.clone();
    const startC = uniforms.u_colorC.value.clone();
    const startMs = performance.now();
    const durationMs = 280;

    const stepInterpolation = () => {
      const t = Math.min(1, (performance.now() - startMs) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);

      uniforms.u_colorA.value.lerpVectors(startA, nextA, eased);
      uniforms.u_colorB.value.lerpVectors(startB, nextB, eased);
      uniforms.u_colorC.value.lerpVectors(startC, nextC, eased);
      uniforms.uColorBase.value.copy(uniforms.u_colorA.value);
      uniforms.uColorCyan.value.copy(uniforms.u_colorB.value);
      uniforms.uColorGreen.value.copy(uniforms.u_colorC.value);

      renderOnceRef.current?.();

      if (t < 1) {
        rafId = window.requestAnimationFrame(stepInterpolation);
      }
    };

    stepInterpolation();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [detectedTheme]);

  // GSAP ScrollTrigger + Glacial 24s Ambient Drift + Global Mouse Micro-Parallax (quickTo, desktop-only)
  useEconovaGSAP(
    rootRef,
    () => {
      if (!active || typeof window === 'undefined') return;
      const rootEl = rootRef.current;
      const parallaxEl = parallaxLayerRef.current;
      const mountEl = mountRef.current;
      if (!rootEl || !parallaxEl) return;

      const prefersReducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      rootEl.setAttribute('data-time-multiplier', GLACIAL_LIQUID_TIME_MULTIPLIER.toFixed(2));
      rootEl.setAttribute('data-glacial-duration', String(GLACIAL_AMBIENT_DURATION_SEC));

      // 1. Glacial, barely perceptible 24s sine.inOut ambient flow drift
      const glacialDriftTween =
        !prefersReducedMotion && mountEl
          ? gsap.to(mountEl, {
              x: 10,
              y: -8,
              scale: 1.03,
              duration: GLACIAL_AMBIENT_DURATION_SEC,
              delay: -6,
              repeat: -1,
              yoyo: true,
              ease: 'sine.inOut',
              force3D: true,
            })
          : null;

      // 2. Scrubbed ScrollTrigger for viscous, jitter-free scroll progress
      const scrubTween = !prefersReducedMotion
        ? gsap.to(scrollProxyRef.current, {
            progress: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: document.documentElement,
              start: 'top top',
              end: 'max',
              scrub: 1.6,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                const maxScroll = Math.max(
                  600,
                  document.documentElement.scrollHeight - window.innerHeight
                );
                scrollProxyRef.current.maxScroll = maxScroll;
                scrollProxyRef.current.scrollY = self.progress * maxScroll;
              },
            },
          })
        : null;

      // 3. Global mouse micro-parallax via gsap.quickTo() & matchMedia (disabled on <= 768px mobile)
      const mm = gsap.matchMedia();
      mm.add(
        {
          isDesktop: '(min-width: 769px)',
          isMobile: '(max-width: 768px)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { isDesktop, reduceMotion } = context.conditions ?? {};

          if (!isDesktop || reduceMotion) {
            gsap.set(parallaxEl, { x: 0, y: 0, force3D: true });
            rootEl.setAttribute('data-parallax-mode', reduceMotion ? 'reduced' : 'disabled-mobile');
            return;
          }

          rootEl.setAttribute('data-parallax-mode', 'desktop-active');

          const quickX = gsap.quickTo(parallaxEl, 'x', {
            duration: 1.8,
            ease: 'sine.inOut',
          });
          const quickY = gsap.quickTo(parallaxEl, 'y', {
            duration: 1.8,
            ease: 'sine.inOut',
          });

          const handleMouseMove = (event: MouseEvent) => {
            const offset = computeBackgroundParallaxOffset({
              clientX: event.clientX,
              clientY: event.clientY,
              viewportWidth: window.innerWidth,
              viewportHeight: window.innerHeight,
              maxOffsetPx: DEFAULT_BG_PARALLAX_MAX_PX,
            });
            quickX(offset.x);
            quickY(offset.y);
          };

          const handlePointerReset = () => {
            quickX(0);
            quickY(0);
          };

          window.addEventListener('mousemove', handleMouseMove, { passive: true });
          window.addEventListener('blur', handlePointerReset);
          document.addEventListener('mouseleave', handlePointerReset);

          return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('blur', handlePointerReset);
            document.removeEventListener('mouseleave', handlePointerReset);
          };
        }
      );

      return () => {
        glacialDriftTween?.kill();
        scrubTween?.scrollTrigger?.kill();
        scrubTween?.kill();
        mm.revert();
      };
    },
    { dependencies: [active] }
  );

  // Isolated Three.js WebGL shader lifecycle
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const rootEl = rootRef.current;
    const container = mountRef.current;
    if (!rootEl || !container) return;

    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl =
          probeCanvas.getContext('webgl2') ||
          probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));

    const getBounds = () => ({
      width: Math.max(container.clientWidth || window.innerWidth, 1),
      height: Math.max(container.clientHeight || window.innerHeight, 1),
    });

    const initialBounds = getBounds();
    renderer.setSize(initialBounds.width, initialBounds.height, false);

    const canvasEl = renderer.domElement;
    canvasEl.setAttribute('data-testid', 'economics-webgl-canvas');
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.display = 'block';

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(canvasEl);

    const scene = new THREE.Scene();
    const initialAspect = initialBounds.width / Math.max(1, initialBounds.height);
    const camera = new THREE.PerspectiveCamera(46, initialAspect, 0.1, 100);
    camera.position.set(0, 0, DEFAULT_WEBGL_BASE_Z);

    const initialTheme = readActiveDocumentTheme();
    const initialPalette = resolveActiveEconomicsShaderPalette(initialTheme);
    const { baseSlateRgb, cyanAccentRgb, greenAccentRgb } = initialPalette;

    rootEl.setAttribute('data-active-theme', initialTheme);
    rootEl.setAttribute('data-uniform-color-a', initialPalette.baseSlateHex);
    rootEl.setAttribute('data-uniform-color-b', initialPalette.cyanAccentHex);
    rootEl.setAttribute('data-uniform-color-c', initialPalette.greenAccentHex);
    rootEl.setAttribute('data-camera-z', DEFAULT_WEBGL_BASE_Z.toFixed(3));
    rootEl.setAttribute('data-scroll-boost', '0.000');

    const vecA = new THREE.Vector3(baseSlateRgb.r, baseSlateRgb.g, baseSlateRgb.b);
    const vecB = new THREE.Vector3(cyanAccentRgb.r, cyanAccentRgb.g, cyanAccentRgb.b);
    const vecC = new THREE.Vector3(greenAccentRgb.r, greenAccentRgb.g, greenAccentRgb.b);

    targetColorsRef.current = {
      colorA: vecA.clone(),
      colorB: vecB.clone(),
      colorC: vecC.clone(),
    };

    const uniforms: UniformSet = {
      uTime: { value: 0 },
      uScrollY: { value: 0 },
      uScrollVelocity: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(initialBounds.width, initialBounds.height),
      },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      u_colorA: { value: vecA.clone() },
      u_colorB: { value: vecB.clone() },
      u_colorC: { value: vecC.clone() },
      uColorBase: { value: vecA.clone() },
      uColorCyan: { value: vecB.clone() },
      uColorGreen: { value: vecC.clone() },
    };
    uniformsRef.current = uniforms;

    const geometry = new THREE.PlaneGeometry(14, 14);
    const material = new THREE.ShaderMaterial({
      vertexShader: ECONOMICS_LIQUID_VERTEX_SHADER,
      fragmentShader: ECONOMICS_LIQUID_FRAGMENT_SHADER,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });

    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    const targetPointer = new THREE.Vector2(0.5, 0.5);
    const handlePointerMove = (e: PointerEvent) => {
      const w = Math.max(window.innerWidth, 1);
      const h = Math.max(window.innerHeight, 1);
      targetPointer.set(e.clientX / w, 1.0 - e.clientY / h);
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const handleResize = () => {
      const next = getBounds();
      renderer.setSize(next.width, next.height, false);
      uniforms.uResolution.value.set(next.width, next.height);
      camera.aspect = next.width / Math.max(1, next.height);
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let viscousState: ViscousBackgroundScrollState = {
      scrollY: 0,
      scrollProgress: 0,
      velocitySmooth: 0,
      cameraZ: DEFAULT_WEBGL_BASE_Z,
      accumulatedTime: 0,
    };

    let lastTickMs = performance.now();
    let frameId = 0;
    let disposed = false;

    renderOnceRef.current = () => {
      if (disposed) return;
      renderer.render(scene, camera);
    };

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext | WebGLRenderingContext;
      if (
        typeof WebGL2RenderingContext !== 'undefined' &&
        gl instanceof WebGL2RenderingContext
      ) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (disposed) return;
      const nowMs = performance.now();
      const dtSeconds = Math.max(0.001, (nowMs - lastTickMs) * 0.001);
      lastTickMs = nowMs;

      const scrubbed = scrollProxyRef.current;

      if (!prefersReducedMotion) {
        viscousState = stepViscousBackgroundScroll(
          viscousState,
          {
            scrubbedProgress: scrubbed.progress,
            scrubbedScrollY: scrubbed.scrollY,
            maxScroll: scrubbed.maxScroll,
            baseZ: DEFAULT_WEBGL_BASE_Z,
            minZ: DEFAULT_WEBGL_MIN_Z,
          },
          dtSeconds
        );
      } else {
        viscousState = {
          scrollY: 0,
          scrollProgress: 0,
          velocitySmooth: 0,
          cameraZ: DEFAULT_WEBGL_BASE_Z,
          accumulatedTime: 0,
        };
      }

      camera.position.z = viscousState.cameraZ;
      uniforms.uTime.value = viscousState.accumulatedTime * GLACIAL_LIQUID_TIME_MULTIPLIER;
      uniforms.uScrollY.value = viscousState.scrollY;
      uniforms.uScrollVelocity.value = viscousState.velocitySmooth;
      uniforms.uPointer.value.lerp(targetPointer, 0.008);

      rootEl.setAttribute('data-camera-z', viscousState.cameraZ.toFixed(3));
      rootEl.setAttribute('data-scroll-boost', viscousState.velocitySmooth.toFixed(3));
      rootEl.setAttribute('data-scroll-y', Math.round(viscousState.scrollY).toString());
      rootEl.setAttribute('data-utime', uniforms.uTime.value.toFixed(3));

      if (targetColorsRef.current) {
        uniforms.u_colorA.value.lerp(targetColorsRef.current.colorA, 0.12);
        uniforms.u_colorB.value.lerp(targetColorsRef.current.colorB, 0.12);
        uniforms.u_colorC.value.lerp(targetColorsRef.current.colorC, 0.12);
        uniforms.uColorBase.value.copy(uniforms.u_colorA.value);
        uniforms.uColorCyan.value.copy(uniforms.u_colorB.value);
        uniforms.uColorGreen.value.copy(uniforms.u_colorC.value);
      }

      renderer.render(scene, camera);

      if (prefersReducedMotion) return;
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      renderOnceRef.current = null;
      uniformsRef.current = null;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      scene.remove(quad);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (canvasEl.parentNode === container) {
        container.removeChild(canvasEl);
      }
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-testid="economics-liquid-bg"
      data-active-theme={detectedTheme}
      className={`no-print fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-theme-base ${className}`}
    >
      {/* Oversized parallax layer (-inset-[44px]) prevents edge clipping during ±25px quickTo + glacial drift */}
      <div
        ref={parallaxLayerRef}
        data-testid="economics-liquid-parallax"
        className="absolute -inset-[44px] will-change-transform"
      >
        <div ref={mountRef} className="h-full w-full will-change-transform" />
      </div>
    </div>
  );
};
