'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Globe } from 'lucide-react';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import type { LocaleCode } from '../shared/types';

export interface LanguageToggleProps {
  locale: LocaleCode;
  onChange: (nextLocale: LocaleCode) => void;
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  locale,
  onChange,
  className = 'hidden md:flex',
}) => {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const enBtnRef = useRef<HTMLButtonElement | null>(null);
  const uzBtnRef = useRef<HTMLButtonElement | null>(null);
  const hasMountedRef = useRef(false);

  useEconovaGSAP(
    groupRef,
    () => {
      if (
        !groupRef.current ||
        !pillRef.current ||
        !enBtnRef.current ||
        !uzBtnRef.current
      ) {
        return;
      }

      const activeBtn = locale === 'en' ? enBtnRef.current : uzBtnRef.current;
      const inactiveBtn = locale === 'en' ? uzBtnRef.current : enBtnRef.current;

      const targetX = activeBtn.offsetLeft;
      const targetWidth = activeBtn.offsetWidth || 44;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!hasMountedRef.current || prefersReducedMotion) {
        hasMountedRef.current = true;
        gsap.set(pillRef.current, {
          x: targetX,
          width: targetWidth,
        });
        gsap.set(activeBtn, {
          color: '#000000',
          opacity: 1,
        });
        gsap.set(inactiveBtn, {
          color: '#9CA3AF',
          opacity: 0.85,
        });
        return;
      }

      gsap.to(pillRef.current, {
        x: targetX,
        width: targetWidth,
        duration: 0.35,
        ease: 'power3.inOut',
        overwrite: 'auto',
      });

      gsap.to(activeBtn, {
        color: '#000000',
        opacity: 1,
        duration: 0.35,
        ease: 'power3.inOut',
        overwrite: 'auto',
      });

      gsap.to(inactiveBtn, {
        color: '#9CA3AF',
        opacity: 0.85,
        duration: 0.35,
        ease: 'power3.inOut',
        overwrite: 'auto',
      });
    },
    { dependencies: [locale] }
  );

  // Re-sync pill alignment if font metrics or container width change
  useEffect(() => {
    const trackEl = trackRef.current;
    if (!trackEl || typeof ResizeObserver === 'undefined') return;

    const syncGeometry = () => {
      if (!pillRef.current || !enBtnRef.current || !uzBtnRef.current) return;
      const activeBtn = locale === 'en' ? enBtnRef.current : uzBtnRef.current;
      gsap.set(pillRef.current, {
        x: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth || 44,
      });
    };

    const observer = new ResizeObserver(syncGeometry);
    observer.observe(trackEl);
    return () => observer.disconnect();
  }, [locale]);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="Language Edition Switcher"
      data-testid="header-language-toggle"
      data-active-locale={locale}
      className={`${className} relative items-center rounded-lg border-2 border-slate-500 bg-white/25 p-1 text-xs shadow-[4px_4px_0px_#000000] backdrop-blur-xl dark:border-[#222B3D] dark:bg-[#101522]/30 shrink-0`}
    >
      <Globe
        className="ml-1.5 mr-1.5 hidden h-3.5 w-3.5 text-gray-400 sm:block shrink-0"
        aria-hidden="true"
      />
      <div ref={trackRef} className="relative flex items-center">
        <span
          ref={pillRef}
          aria-hidden="true"
          data-testid="language-toggle-pill"
          className="pointer-events-none absolute top-0 bottom-0 left-0 rounded-md border-2 border-black bg-[#5DE1D2] shadow-[2px_2px_0px_#000] will-change-transform"
          style={{ width: 44 }}
        />
        <button
          ref={enBtnRef}
          type="button"
          data-testid="lang-toggle-en"
          aria-pressed={locale === 'en'}
          onClick={() => onChange('en')}
          className={`relative z-10 inline-flex min-h-[30px] min-w-[42px] items-center justify-center rounded-md px-2.5 py-1 font-mono text-xs whitespace-nowrap transition-none ${
            locale === 'en' ? 'font-bold text-black' : 'font-semibold text-gray-400'
          }`}
        >
          EN
        </button>
        <button
          ref={uzBtnRef}
          type="button"
          data-testid="lang-toggle-uz"
          aria-pressed={locale === 'uz'}
          onClick={() => onChange('uz')}
          className={`relative z-10 inline-flex min-h-[30px] min-w-[44px] items-center justify-center rounded-md px-2.5 py-1 font-mono text-xs whitespace-nowrap transition-none ${
            locale === 'uz' ? 'font-bold text-black' : 'font-semibold text-gray-400'
          }`}
        >
          O‘Z
        </button>
      </div>
    </div>
  );
};

export default LanguageToggle;
