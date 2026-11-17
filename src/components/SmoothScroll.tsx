'use client';

import React, { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  publishGlobalScrollSnapshot,
  registerLenisInstance,
} from '../lib/scroll-sync';

gsap.registerPlugin(ScrollTrigger);

interface SmoothScrollProps {
  children: React.ReactNode;
}

/**
 * Global Lenis Smooth Scroll wrapper.
 * Synchronizes Lenis `raf()` directly onto `gsap.ticker` (`lagSmoothing(0)`)
 * and forwards every scroll frame to `ScrollTrigger.update` and the shared
 * global scroll state bus consumed by the WebGL Reactive Data Topography shader.
 */
export const SmoothScroll: React.FC<SmoothScrollProps> = ({ children }) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const getScrollLimit = () =>
      Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );

    if (prefersReducedMotion) {
      document.documentElement.setAttribute('data-lenis-ready', 'reduced-motion');
      const handleReducedScroll = () => {
        const y = window.scrollY || window.pageYOffset || 0;
        const limit = getScrollLimit();
        publishGlobalScrollSnapshot({
          scrollY: y,
          limit,
          progress: y / limit,
          velocity: 0,
          isScrolling: false,
          timestampMs: performance.now(),
        });
        ScrollTrigger.update();
      };
      handleReducedScroll();
      window.addEventListener('scroll', handleReducedScroll, { passive: true });
      return () => {
        window.removeEventListener('scroll', handleReducedScroll);
        document.documentElement.removeAttribute('data-lenis-ready');
      };
    }

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
      autoResize: true,
    });

    registerLenisInstance(lenis);
    document.documentElement.setAttribute('data-lenis-ready', 'true');

    let lastScrollY = window.scrollY || 0;
    let lastTimeMs = performance.now();
    let idleTimeoutId = 0;

    const scheduleIdleReset = () => {
      if (idleTimeoutId) {
        window.clearTimeout(idleTimeoutId);
      }
      idleTimeoutId = window.setTimeout(() => {
        const y = lenis.scroll ?? window.scrollY ?? 0;
        const limit = Math.max(1, lenis.limit || getScrollLimit());
        publishGlobalScrollSnapshot({
          scrollY: y,
          limit,
          progress: y / limit,
          velocity: 0,
          isScrolling: false,
          timestampMs: performance.now(),
        });
      }, 180);
    };

    const handleLenisScroll = (eventData?: {
      scroll?: number;
      limit?: number;
      progress?: number;
      velocity?: number;
      isScrolling?: boolean | string;
    }) => {
      const now = performance.now();
      const dt = Math.max(1, now - lastTimeMs);
      const scrollY = eventData?.scroll ?? lenis.scroll ?? window.scrollY ?? 0;
      const limit = Math.max(1, eventData?.limit ?? lenis.limit ?? getScrollLimit());
      const progress = eventData?.progress ?? scrollY / limit;

      // Use Lenis velocity when wheel-driven, or derive instantaneous velocity on native scroll jumps
      const rawLenisVel = Number(eventData?.velocity ?? 0);
      const deltaY = scrollY - lastScrollY;
      const derivedVel = (deltaY / dt) * 16.67;
      const effectiveVelocity =
        Math.abs(rawLenisVel) > 0.05 ? rawLenisVel : derivedVel;

      lastScrollY = scrollY;
      lastTimeMs = now;

      publishGlobalScrollSnapshot({
        scrollY,
        limit,
        progress,
        velocity: effectiveVelocity,
        isScrolling: Boolean(eventData?.isScrolling ?? Math.abs(effectiveVelocity) > 0.05),
        timestampMs: now,
      });

      ScrollTrigger.update();
      scheduleIdleReset();
    };

    const handleNativeScrollFallback = () => {
      const y = window.scrollY || 0;
      if (Math.abs(y - lastScrollY) > 0.5) {
        handleLenisScroll({
          scroll: y,
          limit: getScrollLimit(),
        });
      }
    };

    lenis.on('scroll', handleLenisScroll);
    window.addEventListener('scroll', handleNativeScrollFallback, { passive: true });

    const onGsapTick = (timeSeconds: number) => {
      lenis.raf(timeSeconds * 1000);
    };

    gsap.ticker.add(onGsapTick);
    gsap.ticker.lagSmoothing(0);

    // Publish initial resting frame
    publishGlobalScrollSnapshot({
      scrollY: window.scrollY || 0,
      limit: getScrollLimit(),
      progress: (window.scrollY || 0) / getScrollLimit(),
      velocity: 0,
      isScrolling: false,
      timestampMs: performance.now(),
    });

    return () => {
      if (idleTimeoutId) {
        window.clearTimeout(idleTimeoutId);
      }
      gsap.ticker.remove(onGsapTick);
      gsap.ticker.lagSmoothing(500, 33);
      window.removeEventListener('scroll', handleNativeScrollFallback);
      lenis.off('scroll', handleLenisScroll);
      registerLenisInstance(null);
      lenis.destroy();
      document.documentElement.removeAttribute('data-lenis-ready');
      document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');
    };
  }, []);

  return <>{children}</>;
};
