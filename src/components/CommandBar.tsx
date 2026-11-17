'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  ArrowRight,
  Compass,
  Globe,
  LayoutDashboard,
  Moon,
  Search,
  Sparkles,
  Sun,
  User,
  X,
} from 'lucide-react';
import {
  COMMAND_BAR_COMPACT_GEOMETRY,
  buildCommandBarActions,
  filterCommandBarActions,
  getCommandBarGeometry,
  isCommandBarShortcutEvent,
  type CommandBarActionItem,
} from '../lib/command-bar';
import type { AppNavTab } from '../lib/auth-routing';
import type { ThemeMode } from '../lib/theme';
import type { CourseCatalogItem, LocaleCode } from '../shared/types';

gsap.registerPlugin(useGSAP);

export interface CommandBarProps {
  locale: LocaleCode;
  theme: ThemeMode;
  courses: CourseCatalogItem[];
  onNavigateTab: (tab: AppNavTab) => void;
  onOpenCourse: (courseId: string, locale: LocaleCode) => void;
  onJumpSection?: (sectionId: 'economics' | 'mathematics' | 'business') => void;
  onSwitchLocale: (nextLocale: LocaleCode) => void;
  onToggleTheme: (nextTheme: ThemeMode) => void;
  onOpenShortcuts?: () => void;
}

function renderActionIcon(action: CommandBarActionItem): React.ReactNode {
  switch (action.kind.type) {
    case 'toggle-locale':
      return <Globe className="h-4 w-4 shrink-0 text-[#5DE1D2]" aria-hidden="true" />;
    case 'toggle-theme':
      return action.kind.nextTheme === 'light' ? (
        <Sun className="h-4 w-4 shrink-0 text-[#FFC96B]" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 shrink-0 text-[#9274FF]" aria-hidden="true" />
      );
    case 'open-course':
    case 'jump-section':
      return <Compass className="h-4 w-4 shrink-0 text-[#6FE0A1]" aria-hidden="true" />;
    case 'navigate':
      if (action.kind.tab === 'profile') {
        return <User className="h-4 w-4 shrink-0 text-[#9274FF]" aria-hidden="true" />;
      }
      return <LayoutDashboard className="h-4 w-4 shrink-0 text-[#9274FF]" aria-hidden="true" />;
    case 'open-shortcuts':
      return <Sparkles className="h-4 w-4 shrink-0 text-[#5DE1D2]" aria-hidden="true" />;
  }
}

export const CommandBar: React.FC<CommandBarProps> = ({
  locale,
  theme,
  courses,
  onNavigateTab,
  onOpenCourse,
  onJumpSection,
  onSwitchLocale,
  onToggleTheme,
  onOpenShortcuts,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const islandRef = containerRef;
  const paletteBodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasInteractedRef = useRef(false);

  const initialIslandStyle = useMemo<React.CSSProperties>(
    () => ({
      width: COMMAND_BAR_COMPACT_GEOMETRY.width,
      height: COMMAND_BAR_COMPACT_GEOMETRY.height,
      borderRadius: COMMAND_BAR_COMPACT_GEOMETRY.borderRadius,
    }),
    []
  );

  const isUz = locale === 'uz';

  const allActions = useMemo(
    () =>
      buildCommandBarActions({
        locale,
        theme,
        courses,
      }),
    [locale, theme, courses]
  );

  const visibleActions = useMemo(
    () => filterCommandBarActions(allActions, query),
    [allActions, query]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, isExpanded]);

  // Global Cmd+K / Ctrl+K toggle and Escape handler
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (
        isCommandBarShortcutEvent({
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          repeat: event.repeat,
        })
      ) {
        event.preventDefault();
        hasInteractedRef.current = true;
        setIsExpanded((prev) => !prev);
        return;
      }

      if (event.key === 'Escape' && isExpanded) {
        event.preventDefault();
        setIsExpanded(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isExpanded]);

  // Click-outside & focus-outside listener to collapse the island automatically
  useEffect(() => {
    if (!isExpanded) return;

    const handleOutsideInteraction = (event: MouseEvent | TouchEvent | FocusEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });
    document.addEventListener('focusin', handleOutsideInteraction);
    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
      document.removeEventListener('focusin', handleOutsideInteraction);
    };
  }, [isExpanded]);

  // Keep expanded geometry responsive if the viewport resizes while open
  useEffect(() => {
    if (!isExpanded || typeof window === 'undefined') return;

    const handleResize = () => {
      if (!containerRef.current) return;
      const target = getCommandBarGeometry(true, window.innerWidth, window.innerHeight);
      gsap.set(containerRef.current, target);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded]);

  // Auto-focus search input on expand and clear query on collapse
  useEffect(() => {
    if (isExpanded) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(timer);
    }

    setQuery('');
    setSelectedIndex(0);
    return undefined;
  }, [isExpanded]);

  // Fluid GSAP morph between compact Dynamic Island pill (116x40) and expanded palette (600x400)
  useGSAP(
    () => {
      if (!containerRef.current) return;
      const islandEl = containerRef.current;

      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      const target = getCommandBarGeometry(isExpanded, viewportWidth, viewportHeight);

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!hasInteractedRef.current || prefersReducedMotion) {
        gsap.set(islandEl, target);
        if (paletteBodyRef.current && isExpanded) {
          gsap.set(paletteBodyRef.current, { opacity: 1, y: 0 });
        }
        return;
      }

      const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

      if (isExpanded) {
        tl.to(islandEl, {
          width: target.width,
          height: target.height,
          borderRadius: target.borderRadius,
          duration: 0.5,
          ease: 'elastic.out(1, 0.75)',
        });

        if (paletteBodyRef.current) {
          tl.fromTo(
            paletteBodyRef.current,
            { opacity: 0, y: -8 },
            { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' },
            0.06
          );
        }
      } else {
        tl.to(islandEl, {
          width: COMMAND_BAR_COMPACT_GEOMETRY.width,
          height: COMMAND_BAR_COMPACT_GEOMETRY.height,
          borderRadius: COMMAND_BAR_COMPACT_GEOMETRY.borderRadius,
          duration: 0.3,
          ease: 'power3.out',
        });
      }
    },
    { scope: containerRef, dependencies: [isExpanded] }
  );

  const executeAction = useCallback(
    (action: CommandBarActionItem) => {
      setIsExpanded(false);
      switch (action.kind.type) {
        case 'navigate':
          onNavigateTab(action.kind.tab);
          break;
        case 'open-course':
          onOpenCourse(action.kind.courseId, locale);
          break;
        case 'jump-section':
          onJumpSection?.(action.kind.sectionId);
          break;
        case 'toggle-locale':
          onSwitchLocale(action.kind.nextLocale);
          break;
        case 'toggle-theme':
          onToggleTheme(action.kind.nextTheme);
          break;
        case 'open-shortcuts':
          onOpenShortcuts?.();
          break;
      }
    },
    [
      locale,
      onJumpSection,
      onNavigateTab,
      onOpenCourse,
      onOpenShortcuts,
      onSwitchLocale,
      onToggleTheme,
    ]
  );

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (visibleActions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % visibleActions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + visibleActions.length) % visibleActions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = visibleActions[selectedIndex] ?? visibleActions[0];
      if (chosen) {
        executeAction(chosen);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="global-command-bar"
      data-expanded={isExpanded ? 'true' : 'false'}
      role={isExpanded ? 'dialog' : 'region'}
      aria-modal={isExpanded ? 'true' : undefined}
      aria-label={isUz ? 'Tezkor buyruqlar paneli' : 'Global Command Bar'}
      style={initialIslandStyle}
      className="no-print fixed top-4 left-1/2 -translate-x-1/2 z-50 overflow-hidden border-2 border-gray-900 bg-white/85 text-gray-900 shadow-[8px_8px_0px_#111827] backdrop-blur-2xl will-change-[width,height,border-radius] dark:border-[#222B3D] dark:bg-[#101522]/40 dark:text-white dark:shadow-[8px_8px_0px_#000000]"
    >
      {!isExpanded ? (
        <button
          type="button"
          data-testid="command-bar-trigger"
          onClick={() => {
            hasInteractedRef.current = true;
            setIsExpanded(true);
          }}
          aria-label={isUz ? 'Buyruqlar panelini ochish (⌘ K)' : 'Open Command Bar (⌘ K)'}
          className="flex h-full w-full items-center justify-center gap-2 px-3 font-mono text-xs font-bold text-gray-900 hover:text-[#5B21B6] dark:text-gray-200 dark:hover:text-white"
        >
          <Search
            className="h-3.5 w-3.5 shrink-0 text-[#5B21B6] dark:text-[#5DE1D2]"
            aria-hidden="true"
          />
          <span className="tracking-wider text-gray-700 dark:text-gray-200/90">⌘ K</span>
        </button>
      ) : (
        <div
          ref={paletteBodyRef}
          data-testid="command-bar-palette"
          className="flex h-full w-full flex-col"
        >
          {/* Completely Borderless Transparent Search Input Row */}
          <div className="flex h-14 shrink-0 items-center gap-3 border-b-2 border-gray-900 px-4 dark:border-[#222B3D]">
            <Search
              className="h-4 w-4 shrink-0 text-[#5B21B6] dark:text-[#5DE1D2]"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              data-testid="command-bar-input"
              aria-label={isUz ? 'Buyruq yoki kurs qidirish' : 'Search commands or courses'}
              placeholder={
                isUz
                  ? 'Buyruq yoki kurs nomini yozing…'
                  : 'Search courses, actions, or switch language…'
              }
              className="w-full min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-gray-900 placeholder:text-gray-500 outline-none focus:ring-0 dark:text-white dark:placeholder:text-gray-400"
            />
            <button
              type="button"
              data-testid="command-bar-close"
              onClick={() => setIsExpanded(false)}
              aria-label={isUz ? 'Yopish' : 'Close Command Bar'}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border-2 border-gray-900 bg-gray-100 px-2 font-mono text-[10px] font-bold text-gray-900 shadow-[2px_2px_0px_#111827] hover:border-[#9274FF] dark:border-[#222B3D] dark:bg-[#080B14]/80 dark:text-gray-200 dark:shadow-[2px_2px_0px_#000000]"
            >
              <span>ESC</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>

          {/* Neobrutalist Quick Actions Grid */}
          <div className="flex-1 overflow-y-auto p-3.5">
            <div className="mb-2.5 flex items-center justify-between px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              <span>{isUz ? 'Tezkor amallar' : 'Quick Actions'}</span>
              <span>
                {visibleActions.length} {isUz ? 'ta buyruq' : 'actions'}
              </span>
            </div>

            {visibleActions.length === 0 ? (
              <div
                data-testid="command-bar-empty"
                className="flex h-56 items-center justify-center rounded-lg border-2 border-dashed border-gray-400 font-mono text-xs text-gray-600 dark:border-[#222B3D] dark:text-gray-300"
              >
                {isUz
                  ? `"${query}" bo‘yicha natija topilmadi.`
                  : `No matching commands for "${query}".`}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {visibleActions.map((action, idx) => {
                  const isActive = idx === selectedIndex;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      data-testid={`command-bar-action-${action.id}`}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => executeAction(action)}
                      className={`group flex items-center justify-between gap-2.5 rounded-lg border-2 px-3 py-2.5 text-left ${
                        isActive
                          ? 'border-[#9274FF] bg-[#9274FF]/15 text-gray-900 shadow-[4px_4px_0px_#111827] dark:text-white dark:shadow-[4px_4px_0px_#000000]'
                          : 'border-gray-900/25 bg-white/70 text-gray-900 hover:border-[#9274FF] dark:border-[#222B3D] dark:bg-[#080B14]/65 dark:text-gray-200'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {renderActionIcon(action)}
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-gray-900 dark:text-white">
                            {action.label}
                          </div>
                          <div className="truncate text-[10px] text-gray-600 dark:text-gray-300">
                            {action.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {action.shortcutHint && (
                          <kbd className="rounded border border-gray-900/40 bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-gray-800 dark:border-[#222B3D] dark:bg-[#101522] dark:text-gray-200">
                            {action.shortcutHint}
                          </kbd>
                        )}
                        <ArrowRight
                          className={`h-3.5 w-3.5 ${
                            isActive
                              ? 'translate-x-0.5 text-[#5B21B6] dark:text-[#5DE1D2]'
                              : 'text-gray-400 group-hover:text-[#5DE1D2]'
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Palette Keyboard Legend Footer */}
          <div className="flex h-9 shrink-0 items-center justify-between border-t-2 border-gray-900 px-4 font-mono text-[10px] font-bold text-gray-600 dark:border-[#222B3D] dark:text-gray-400">
            <span>ECONOVA // DYNAMIC ISLAND</span>
            <span>↑↓ Navigate · ↵ Run · Esc Close</span>
          </div>
        </div>
      )}
    </div>
  );
};
