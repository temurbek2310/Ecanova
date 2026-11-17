'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ECONOMICS_LIQUID_FRAGMENT_SHADER,
  ECONOMICS_LIQUID_VERTEX_SHADER,
  resolveActiveEconomicsShaderPalette,
} from '../lib/economics-shader';
import {
  DEFAULT_WEBGL_BASE_Z,
  DEFAULT_WEBGL_MIN_Z,
  getGlobalScrollSnapshot,
  stepWebGLScrollState,
  type WebGLScrollState,
} from '../lib/scroll-sync';
import {
  observeDocumentTheme,
  readActiveDocumentTheme,
  type ThemeMode,
} from '../lib/theme';

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
 * Fixed Three.js WebGL "Reactive Data Topography" liquid shader background.
 * Syncs with global Lenis scroll progress (`window.scrollY` & scroll velocity):
 * - Maps `scrollY` smoothly onto `PerspectiveCamera.position.z`
 * - Accelerates `uTime` & `uScrollVelocity` distortion during fast scroll, then
 *   smoothly interpolates back to a calm passive idle flow when stopped.
 * - Preserves live theme switching and software-WebGL `afterDraw()` pacing.
 */
export const EconomicsLiquidBackground: React.FC<EconomicsLiquidBackgroundProps> = ({
  active = true,
  theme,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const uniformsRef = useRef<UniformSet | null>(null);
  const targetColorsRef = useRef<{
    colorA: THREE.Vector3;
    colorB: THREE.Vector3;
    colorC: THREE.Vector3;
  } | null>(null);
  const renderOnceRef = useRef<(() => void) | null>(null);

  const [detectedTheme, setDetectedTheme] = useState<ThemeMode>(() =>
    theme ?? readActiveDocumentTheme()
  );

  // Sync with prop if passed
  useEffect(() => {
    if (theme) {
      setDetectedTheme(theme);
    }
  }, [theme]);

  // Listen for dynamic theme changes on <html> (class / data-theme) via MutationObserver
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDetectedTheme(theme ?? readActiveDocumentTheme());
    return observeDocumentTheme((nextTheme) => {
      setDetectedTheme(nextTheme);
    });
  }, [theme]);

  // Dynamically interpolate & update WebGL uniforms when active theme changes
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

    if (mountRef.current) {
      mountRef.current.setAttribute('data-active-theme', detectedTheme);
      mountRef.current.setAttribute('data-uniform-color-a', palette.baseSlateHex);
      mountRef.current.setAttribute('data-uniform-color-b', palette.cyanAccentHex);
      mountRef.current.setAttribute('data-uniform-color-c', palette.greenAccentHex);
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

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL (SwiftShader / llvmpipe / Basic Render) per Three.js skill guidelines
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

    container.setAttribute('data-active-theme', initialTheme);
    container.setAttribute('data-uniform-color-a', initialPalette.baseSlateHex);
    container.setAttribute('data-uniform-color-b', initialPalette.cyanAccentHex);
    container.setAttribute('data-uniform-color-c', initialPalette.greenAccentHex);
    container.setAttribute('data-camera-z', DEFAULT_WEBGL_BASE_Z.toFixed(3));
    container.setAttribute('data-scroll-boost', '0.000');

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

    // Oversized topographical plane so perspective camera Z scrubbing never exposes viewport edges
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

    let scrollState: WebGLScrollState = {
      cameraZ: DEFAULT_WEBGL_BASE_Z,
      scrollY: window.scrollY || 0,
      scrollBoost: 0,
      timeSpeedMultiplier: 1.0,
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

      const snapshot = getGlobalScrollSnapshot();
      const activeScrollY = snapshot.scrollY || window.scrollY || 0;
      const maxScroll = Math.max(
        600,
        snapshot.limit || document.documentElement.scrollHeight - window.innerHeight
      );

      if (!prefersReducedMotion) {
        scrollState = stepWebGLScrollState(
          scrollState,
          {
            scrollY: activeScrollY,
            maxScroll,
            velocity: snapshot.velocity,
            baseZ: DEFAULT_WEBGL_BASE_Z,
            minZ: DEFAULT_WEBGL_MIN_Z,
          },
          dtSeconds
        );
      } else {
        scrollState = {
          cameraZ: DEFAULT_WEBGL_BASE_Z,
          scrollY: activeScrollY,
          scrollBoost: 0,
          timeSpeedMultiplier: 1.0,
          accumulatedTime: 0,
        };
      }

      camera.position.z = scrollState.cameraZ;
      uniforms.uTime.value = scrollState.accumulatedTime;
      uniforms.uScrollY.value = scrollState.scrollY;
      uniforms.uScrollVelocity.value = scrollState.scrollBoost;
      uniforms.uPointer.value.lerp(targetPointer, 0.06);

      container.setAttribute('data-camera-z', scrollState.cameraZ.toFixed(3));
      container.setAttribute('data-scroll-boost', scrollState.scrollBoost.toFixed(3));
      container.setAttribute('data-scroll-y', Math.round(scrollState.scrollY).toString());

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
      ref={mountRef}
      aria-hidden="true"
      data-testid="economics-liquid-bg"
      data-active-theme={detectedTheme}
      className={`no-print pointer-events-none fixed inset-0 z-0 overflow-hidden bg-theme-base ${className}`}
    />
  );
};
