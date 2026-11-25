'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import {
  ArrowRight,
  Clock,
  Compass,
  Globe,
  Keyboard,
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
  COMMAND_BAR_MOBILE_COMPACT_GEOMETRY,
  buildCommandBarActions,
  filterCommandBarActions,
  getCommandBarGeometry,
  isCommandBarShortcutEvent,
  type CommandBarActionItem,
} from '../lib/command-bar';
import type { AppNavTab } from '../lib/auth-routing';
import type { ThemeMode } from '../lib/theme';
import type { CourseCatalogItem, LocaleCode } from '../shared/types';

export const RECENT_SEARCHES_STORAGE_KEY = 'econova_command_bar_recent_searches';

export interface SearchableCourseModule {
  id: string;
  title: string;
  subject: 'Economics' | 'Mathematics' | 'Business';
  courseId: string;
  description?: string;
}

/**
 * Utility function that highlights matched substrings in a high-contrast
 * Neobrutalist span (#5DE1D2 bold) with robust regex escaping.
 */
export function highlightMatch(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    if (parts.length <= 1) return text;

    return parts.map((part, index) =>
      part.toLowerCase() === trimmed.toLowerCase() ? (
        <span key={index} data-command-bar-highlight="true" className="text-[#5DE1D2] font-bold">
          {part}
        </span>
      ) : (
        part
      )
    );
  } catch {
    return text;
  }
}

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
  onExpandedChange?: (expanded: boolean) => void;
}

function renderActionIcon(action: CommandBarActionItem, isActive: boolean = false): React.ReactNode {
  const iconClass = `h-4 w-4 shrink-0 ${isActive ? 'text-white' : ''}`;
  switch (action.kind.type) {
    case 'toggle-locale':
      return <Globe className={`${iconClass} ${!isActive ? 'text-[#5DE1D2]' : ''}`} aria-hidden="true" />;
    case 'toggle-theme':
      return action.kind.nextTheme === 'light' ? (
        <Sun className={`${iconClass} ${!isActive ? 'text-[#FFC96B]' : ''}`} aria-hidden="true" />
      ) : (
        <Moon className={`${iconClass} ${!isActive ? 'text-[#9274FF]' : ''}`} aria-hidden="true" />
      );
    case 'open-course':
    case 'jump-section':
      return <Compass className={`${iconClass} ${!isActive ? 'text-[#6FE0A1]' : ''}`} aria-hidden="true" />;
    case 'navigate':
      if (action.kind.tab === 'profile') {
        return <User className={`${iconClass} ${!isActive ? 'text-[#9274FF]' : ''}`} aria-hidden="true" />;
      }
      return <LayoutDashboard className={`${iconClass} ${!isActive ? 'text-[#9274FF]' : ''}`} aria-hidden="true" />;
    case 'open-shortcuts':
      return <Sparkles className={`${iconClass} ${!isActive ? 'text-[#5DE1D2]' : ''}`} aria-hidden="true" />;
  }
}

type CommandBarNavigableItem =
  | { kind: 'recent'; id: string; term: string }
  | { kind: 'top-result'; id: string; module: SearchableCourseModule }
  | { kind: 'action'; id: string; action: CommandBarActionItem };

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
  onExpandedChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Persistent Recent Searches (max 3 items)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 3);
        }
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paletteBodyRef = useRef<HTMLDivElement | null>(null);
  const actionsContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasInteractedRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecentSearches(parsed.slice(0, 3));
          }
        }
      }
    } catch {
      // Ignore storage access restrictions
    }
  }, []);

  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const updated = [
        trimmed,
        ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, 3);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
        }
      } catch {
        // Ignore storage access restrictions
      }
      return updated;
    });
  }, []);

  const initialIslandStyle = useMemo<React.CSSProperties>(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const compact = isMobile ? COMMAND_BAR_MOBILE_COMPACT_GEOMETRY : COMMAND_BAR_COMPACT_GEOMETRY;
    return {
      width: compact.width,
      height: compact.height,
      borderRadius: compact.borderRadius,
    };
  }, []);

  const isUz = locale === 'uz';

  // Searchable modules come only from the live published catalog.
  const allSearchableModules = useMemo<SearchableCourseModule[]>(() => {
    const list: SearchableCourseModule[] = [];
    courses.forEach((c) => {
      const edition = c.editions[locale] ?? c.editions.en ?? c.editions.uz;
      const title = edition?.title;
      if (title && !list.some((m) => m.title.toLowerCase() === title.toLowerCase())) {
        list.push({
          id: `catalog-${c.id}`,
          title,
          subject: c.subject,
          courseId: c.id,
          description: edition?.subtitle,
        });
      }
    });
    return list;
  }, [courses, locale]);

  // Top 3 filtered modules matching current search query
  const topResults = useMemo<SearchableCourseModule[]>(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];
    return allSearchableModules
      .filter(
        (m) =>
          m.title.toLowerCase().includes(trimmed) ||
          m.subject.toLowerCase().includes(trimmed) ||
          (m.description && m.description.toLowerCase().includes(trimmed))
      )
      .slice(0, 3);
  }, [allSearchableModules, searchQuery]);

  // Standard Quick Actions
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
    () => filterCommandBarActions(allActions, searchQuery),
    [allActions, searchQuery]
  );

  // Unified list of navigable items adapting to idle (Recent Searches) vs active (Top Results) state
  const visibleItems = useMemo<CommandBarNavigableItem[]>(() => {
    if (!searchQuery.trim()) {
      const recentItems: CommandBarNavigableItem[] = recentSearches.map((term, i) => ({
        kind: 'recent',
        id: `recent-${i}`,
        term,
      }));
      const actionItems: CommandBarNavigableItem[] = visibleActions.map((action) => ({
        kind: 'action',
        id: action.id,
        action,
      }));
      return [...recentItems, ...actionItems];
    }

    const resultItems: CommandBarNavigableItem[] = topResults.map((module) => ({
      kind: 'top-result',
      id: module.id,
      module,
    }));
    const actionItems: CommandBarNavigableItem[] = visibleActions.map((action) => ({
      kind: 'action',
      id: action.id,
      action,
    }));
    return [...resultItems, ...actionItems];
  }, [searchQuery, recentSearches, topResults, visibleActions]);

  // Reset active index when query or expanded state changes
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, isExpanded]);

  // Keep active keyboard selection visible within scrollable palette body
  useEffect(() => {
    if (!isExpanded || visibleItems.length === 0) return;
    const targetEl = actionsContainerRef.current?.querySelector(
      `[data-command-bar-action-index="${activeIndex}"]`
    ) as HTMLElement | null;
    targetEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isExpanded, visibleItems.length]);

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

  // Click-outside & focus-outside listener
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

  // Compute horizontal delta from wrapper center to viewport center so expanded overlay never clips on asymmetric mobile headers
  const computeExpandedCenterOffsetX = useCallback((viewportWidth: number): number => {
    if (!wrapperRef.current) return 0;
    const rect = wrapperRef.current.getBoundingClientRect();
    const wrapperCenterX = rect.left + rect.width / 2;
    const viewportCenterX = viewportWidth / 2;
    return Math.round(viewportCenterX - wrapperCenterX);
  }, []);

  // Keep expanded geometry responsive if the viewport resizes while open
  useEffect(() => {
    if (!isExpanded || typeof window === 'undefined') return;

    const handleResize = () => {
      if (!containerRef.current) return;
      const target = getCommandBarGeometry(true, window.innerWidth, window.innerHeight);
      if (window.innerWidth < 768) {
        gsap.set(containerRef.current, {
          clearProps: 'width,x,xPercent,transform',
          height: target.height,
          borderRadius: target.borderRadius,
        });
        return;
      }
      const centerOffsetX = computeExpandedCenterOffsetX(window.innerWidth);
      gsap.set(containerRef.current, { ...target, xPercent: -50, x: centerOffsetX });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [computeExpandedCenterOffsetX, isExpanded]);

  // Auto-focus search input on expand and clear query on collapse
  useEffect(() => {
    if (isExpanded) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(timer);
    }

    setSearchQuery('');
    setActiveIndex(0);
    return undefined;
  }, [isExpanded]);

  // Fluid GSAP morph between compact Dynamic Island pill and expanded palette / mobile takeover
  useEconovaGSAP(
    containerRef,
    () => {
      const islandEl = containerRef.current;
      if (!islandEl) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const mm = gsap.matchMedia();

      // Mobile (< 768px): compact circular idle pill OR full-width fixed viewport takeover
      mm.add('(max-width: 767px)', () => {
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 844;

        if (isExpanded) {
          const target = getCommandBarGeometry(true, viewportWidth, viewportHeight);
          // Clear inline width/x/xPercent so `fixed top-4 left-4 right-4 w-auto z-[100]` governs full width
          gsap.set(islandEl, { clearProps: 'width,x,xPercent,transform' });

          if (!hasInteractedRef.current || prefersReducedMotion) {
            gsap.set(islandEl, {
              height: target.height,
              borderRadius: target.borderRadius,
              y: 0,
              autoAlpha: 1,
            });
            if (paletteBodyRef.current) {
              gsap.set(paletteBodyRef.current, { opacity: 1, y: 0 });
            }
            return;
          }

          const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });
          tl.fromTo(
            islandEl,
            { height: 48, borderRadius: 16, y: -10, autoAlpha: 0.9 },
            {
              height: target.height,
              borderRadius: target.borderRadius,
              y: 0,
              autoAlpha: 1,
              duration: 0.36,
              ease: 'power3.out',
            }
          );

          if (paletteBodyRef.current) {
            tl.fromTo(
              paletteBodyRef.current,
              { opacity: 0, y: -6 },
              { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' },
              0.08
            );
          }
          return;
        }

        const compactMobile = COMMAND_BAR_MOBILE_COMPACT_GEOMETRY;
        if (!hasInteractedRef.current || prefersReducedMotion) {
          gsap.set(islandEl, {
            width: compactMobile.width,
            height: compactMobile.height,
            borderRadius: compactMobile.borderRadius,
            xPercent: 0,
            x: 0,
            y: 0,
            autoAlpha: 1,
          });
          return;
        }

        gsap.to(islandEl, {
          width: compactMobile.width,
          height: compactMobile.height,
          borderRadius: compactMobile.borderRadius,
          xPercent: 0,
          x: 0,
          y: 0,
          duration: 0.28,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      });

      // Desktop (>= 768px): centered 120x40 idle pill <-> elastic centered spotlight overlay
      mm.add('(min-width: 768px)', () => {
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
        const target = getCommandBarGeometry(isExpanded, viewportWidth, viewportHeight);
        const centerOffsetX = isExpanded ? computeExpandedCenterOffsetX(viewportWidth) : 0;
        const targetXPercent = isExpanded ? -50 : 0;

        if (!hasInteractedRef.current || prefersReducedMotion) {
          gsap.set(islandEl, {
            ...target,
            xPercent: targetXPercent,
            x: centerOffsetX,
            y: 0,
            autoAlpha: 1,
          });
          if (paletteBodyRef.current && isExpanded) {
            gsap.set(paletteBodyRef.current, { opacity: 1, y: 0 });
          }
          return;
        }

        const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

        if (isExpanded) {
          gsap.set(islandEl, { xPercent: -50, x: centerOffsetX, y: 0 });
          tl.to(islandEl, {
            width: target.width,
            height: target.height,
            borderRadius: target.borderRadius,
            xPercent: -50,
            x: centerOffsetX,
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
          const compactTarget = getCommandBarGeometry(false, viewportWidth, viewportHeight);
          tl.to(islandEl, {
            width: compactTarget.width,
            height: compactTarget.height,
            borderRadius: compactTarget.borderRadius,
            xPercent: 0,
            x: 0,
            y: 0,
            duration: 0.3,
            ease: 'power3.out',
          });
        }
      });

      return () => {
        mm.revert();
      };
    },
    { dependencies: [isExpanded] }
  );

  const executeAction = useCallback(
    (action: CommandBarActionItem) => {
      saveRecentSearch(action.label);
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
      saveRecentSearch,
    ]
  );

  const handleSelectRecentSearch = useCallback((term: string) => {
    setSearchQuery(term);
    setActiveIndex(0);
    inputRef.current?.focus();
  }, []);

  const handleSelectTopResult = useCallback(
    (module: SearchableCourseModule) => {
      saveRecentSearch(module.title);
      console.log('Selected course module:', module.title);
      onOpenCourse(module.courseId, locale);
      setIsExpanded(false);
    },
    [locale, onOpenCourse, saveRecentSearch]
  );

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (visibleItems.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % visibleItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + visibleItems.length) % visibleItems.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = visibleItems[activeIndex] ?? visibleItems[0];
      if (!chosen) return;

      if (chosen.kind === 'recent') {
        handleSelectRecentSearch(chosen.term);
      } else if (chosen.kind === 'top-result') {
        handleSelectTopResult(chosen.module);
      } else if (chosen.kind === 'action') {
        executeAction(chosen.action);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsExpanded(false);
    }
  };

  return (
    <div
      ref={wrapperRef}
      data-command-bar-wrapper="true"
      className="pointer-events-auto relative flex items-center justify-center h-10 w-10 md:w-[120px] shrink-0"
    >
      {/* Full-viewport backdrop inside header's z-[100] stacking context so CommandBar stays crisp above it */}
      {isExpanded && (
        <div
          data-testid="command-bar-backdrop"
          aria-hidden="true"
          onClick={() => setIsExpanded(false)}
          className="pointer-events-auto fixed inset-0 z-[55] bg-[#080B14]/60 backdrop-blur-sm transition-opacity"
        />
      )}

      {/* GSAP Dynamic Island Container */}
      <div
        ref={containerRef}
        data-testid="global-command-bar"
        data-expanded={isExpanded ? 'true' : 'false'}
        role={isExpanded ? 'dialog' : 'region'}
        aria-modal={isExpanded ? 'true' : undefined}
        aria-label={isUz ? 'Tezkor buyruqlar paneli' : 'Global Command Bar'}
        style={initialIslandStyle}
        className={`no-print overflow-hidden border-2 border-gray-900 text-gray-900 shadow-[8px_8px_0px_#111827] backdrop-blur-2xl will-change-[width,height,border-radius] dark:border-[#222B3D] dark:text-white dark:shadow-[8px_8px_0px_#000000] ${
          isExpanded
            ? 'fixed top-4 left-4 right-4 w-auto z-[100] md:absolute md:top-0 md:left-1/2 md:right-auto md:z-[100] bg-white/95 dark:bg-[#101522]/95 shadow-[12px_12px_0px_#000000]'
            : 'relative z-10 rounded-full bg-white/25 transition-all hover:bg-slate-900/10 hover:shadow-[4px_4px_0px_#090D16] dark:bg-[#101522]/25 dark:hover:bg-[#101522]/40'
        }`}
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
            className="flex h-full w-full items-center justify-center gap-2 rounded-full px-0 md:px-3 font-mono text-xs font-bold text-gray-900 hover:text-[#5B21B6] dark:text-gray-200 dark:hover:text-white"
          >
            <Search
              className="h-4 w-4 shrink-0 text-[#5B21B6] dark:text-[#5DE1D2]"
              aria-hidden="true"
            />
            <span className="hidden md:inline tracking-wider text-gray-700 dark:text-gray-200/90">
              ⌘ K
            </span>
          </button>
        ) : (
          <div
            ref={paletteBodyRef}
            data-testid="command-bar-palette"
            className="flex h-full w-full flex-col"
          >
            {/* Borderless Transparent Search Input Row */}
            <div className="flex h-14 shrink-0 items-center gap-3 border-b-2 border-gray-900 px-4 dark:border-[#222B3D]">
              <Search
                className="h-4 w-4 shrink-0 text-[#5B21B6] dark:text-[#5DE1D2]"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={isExpanded}
                aria-haspopup="listbox"
                aria-autocomplete="list"
                aria-controls="command-bar-actions-list"
                aria-activedescendant={
                  visibleItems[activeIndex]
                    ? `command-bar-item-${visibleItems[activeIndex].id}`
                    : undefined
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                data-testid="command-bar-input"
                aria-label={isUz ? 'Kurs, mavzu yoki buyruq qidirish' : 'Search courses, modules, or actions'}
                placeholder={
                  isUz
                    ? 'Kurs, modul yoki buyruq nomini yozing…'
                    : 'Search courses, modules, or actions (e.g. Inflation, Calculus)…'
                }
                className="w-full min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-gray-900 placeholder:text-gray-500 outline-none focus:ring-0 dark:text-white dark:placeholder:text-gray-400"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveIndex(0);
                    inputRef.current?.focus();
                  }}
                  aria-label={isUz ? 'Tozalash' : 'Clear search'}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-400 bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:border-white/20 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : (
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
              )}
            </div>

            {/* Scrollable Palette Body */}
            <div
              ref={actionsContainerRef}
              id="command-bar-actions-list"
              role="listbox"
              aria-label={isUz ? 'Buyruqlar va natijalar ro‘yxati' : 'Commands and results list'}
              className="flex-1 overflow-y-auto p-3.5 space-y-4"
            >
              {/* SECTION: Idle Recent Searches vs Active Top Results */}
              {!searchQuery.trim() ? (
                /* 1. Recent Searches (Idle State) */
                <div>
                  <div className="mb-2 flex items-center justify-between px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#5DE1D2]" aria-hidden="true" />
                      {isUz ? 'Oxirgi qidiruvlar' : 'Recent Searches'}
                    </span>
                    <span>{recentSearches.length} {isUz ? 'ta' : 'queries'}</span>
                  </div>

                  {recentSearches.length === 0 ? (
                    <div className="py-2 px-3 text-xs italic text-gray-500 dark:text-gray-400">
                      {isUz ? 'Oxirgi qidiruvlar mavjud emas' : 'No recent searches yet'}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {recentSearches.map((term, idx) => {
                        const itemIndex = idx;
                        const isActive = activeIndex === itemIndex;
                        return (
                          <button
                            key={term}
                            id={`command-bar-item-recent-${idx}`}
                            data-command-bar-action-index={itemIndex}
                            role="option"
                            aria-selected={isActive}
                            type="button"
                            tabIndex={-1}
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                            onClick={() => handleSelectRecentSearch(term)}
                            className={`group flex w-full items-center justify-between gap-3 rounded-lg border-2 px-3.5 py-2 text-left transition-all ${
                              isActive
                                ? 'bg-[#9274FF] text-white border-2 border-black shadow-[4px_4px_0px_#000] -translate-y-0.5 dark:bg-[#9274FF] dark:text-white dark:border-black dark:shadow-[4px_4px_0px_#000]'
                                : 'border-transparent bg-transparent text-gray-900 hover:border-gray-900/30 hover:bg-black/5 dark:text-gray-100 dark:hover:border-white/30 dark:hover:bg-white/5'
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Clock
                                className={`h-4 w-4 shrink-0 ${
                                  isActive
                                    ? 'text-white'
                                    : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white'
                                }`}
                                aria-hidden="true"
                              />
                              <span
                                className={`truncate text-xs font-bold ${
                                  isActive ? 'text-white' : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {term}
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <kbd
                                className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                                  isActive
                                    ? 'border-black bg-white text-black shadow-[1px_1px_0px_#000]'
                                    : 'border-gray-900/30 bg-gray-100 text-gray-700 dark:border-white/20 dark:bg-black/40 dark:text-gray-300'
                                }`}
                              >
                                ↵ {isUz ? 'qidirish' : 'search'}
                              </kbd>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* 2. Top Results (Active Query State) with Keyword Highlighting */
                <div>
                  <div className="mb-2 flex items-center justify-between px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#5DE1D2]" aria-hidden="true" />
                      {isUz ? 'Eng mos natijalar' : 'Top Results'}
                    </span>
                    <span>{topResults.length} {isUz ? 'ta natija' : 'matches'}</span>
                  </div>

                  {topResults.length === 0 ? (
                    <div
                      data-testid="command-bar-empty-results"
                      className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-400 font-mono text-xs text-gray-600 dark:border-[#222B3D] dark:text-gray-400"
                    >
                      {isUz
                        ? `"${searchQuery}" bo‘yicha kurs yoki modul topilmadi.`
                        : `No matching course modules for "${searchQuery}".`}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {topResults.map((module, idx) => {
                        const itemIndex = idx;
                        const isActive = activeIndex === itemIndex;
                        return (
                          <button
                            key={module.id}
                            id={`command-bar-item-${module.id}`}
                            data-command-bar-action-index={itemIndex}
                            role="option"
                            aria-selected={isActive}
                            type="button"
                            tabIndex={-1}
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                            onClick={() => handleSelectTopResult(module)}
                            className={`group flex w-full items-center justify-between gap-3 rounded-lg border-2 px-3.5 py-2.5 text-left transition-all ${
                              isActive
                                ? 'bg-[#9274FF] text-white border-2 border-black shadow-[4px_4px_0px_#000] -translate-y-0.5 dark:bg-[#9274FF] dark:text-white dark:border-black dark:shadow-[4px_4px_0px_#000]'
                                : 'border-transparent bg-transparent text-gray-900 hover:border-gray-900/30 hover:bg-black/5 dark:text-gray-100 dark:hover:border-white/30 dark:hover:bg-white/5'
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase border ${
                                  isActive
                                    ? 'border-black bg-black text-[#5DE1D2]'
                                    : 'border-gray-900/30 bg-gray-100 text-gray-700 dark:border-white/20 dark:bg-black/40 dark:text-gray-300'
                                }`}
                              >
                                {module.subject}
                              </span>

                              <div className="min-w-0">
                                <div
                                  className={`truncate text-xs font-bold ${
                                    isActive ? 'text-white' : 'text-gray-900 dark:text-white'
                                  }`}
                                >
                                  {highlightMatch(module.title, searchQuery)}
                                </div>
                                {module.description && (
                                  <div
                                    className={`truncate text-[10px] ${
                                      isActive ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
                                    }`}
                                  >
                                    {highlightMatch(module.description, searchQuery)}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <ArrowRight
                                className={`h-4 w-4 transition-transform ${
                                  isActive
                                    ? 'translate-x-1 text-white'
                                    : 'text-gray-400 group-hover:text-black dark:group-hover:text-white'
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
              )}

              {/* SECTION: Quick Actions */}
              {visibleActions.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    <span>{isUz ? 'Tezkor amallar' : 'Quick Actions'}</span>
                    <span>
                      {visibleActions.length} {isUz ? 'ta buyruq' : 'actions'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {visibleActions.map((action, actionIdx) => {
                      const itemIndex =
                        (!searchQuery.trim() ? recentSearches.length : topResults.length) + actionIdx;
                      const isActive = activeIndex === itemIndex;
                      return (
                        <button
                          key={action.id}
                          id={`command-bar-item-${action.id}`}
                          data-command-bar-action-index={itemIndex}
                          role="option"
                          aria-selected={isActive}
                          type="button"
                          tabIndex={-1}
                          data-testid={`command-bar-action-${action.id}`}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          onClick={() => executeAction(action)}
                          className={`group flex items-center justify-between gap-2.5 rounded-lg border-2 px-3 py-2 text-left transition-all ${
                            isActive
                              ? 'bg-[#9274FF] text-white border-2 border-black shadow-[4px_4px_0px_#000] -translate-y-0.5 dark:bg-[#9274FF] dark:text-white dark:border-black dark:shadow-[4px_4px_0px_#000]'
                              : 'border-transparent bg-transparent text-gray-900 hover:border-gray-900/30 hover:bg-black/5 dark:text-gray-100 dark:hover:border-white/30 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            {renderActionIcon(action, isActive)}
                            <div className="min-w-0">
                              <div
                                className={`truncate text-xs font-bold ${
                                  isActive ? 'text-white' : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {searchQuery.trim()
                                  ? highlightMatch(action.label, searchQuery)
                                  : action.label}
                              </div>
                              <div
                                className={`truncate text-[10px] ${
                                  isActive
                                    ? 'text-white/80 font-medium'
                                    : 'text-gray-600 dark:text-gray-400'
                                }`}
                              >
                                {action.subtitle}
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {action.shortcutHint && (
                              <kbd
                                className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                                  isActive
                                    ? 'border-black bg-white text-black shadow-[1px_1px_0px_#000]'
                                    : 'border-gray-900/40 bg-gray-100 text-gray-800 dark:border-[#222B3D] dark:bg-[#101522] dark:text-gray-200'
                                }`}
                              >
                                {action.shortcutHint}
                              </kbd>
                            )}
                            <ArrowRight
                              className={`h-3.5 w-3.5 transition-transform ${
                                isActive
                                  ? 'translate-x-1 text-white'
                                  : 'text-gray-400 group-hover:text-black dark:group-hover:text-white'
                              }`}
                              aria-hidden="true"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Palette Keyboard Legend Footer */}
            <div className="flex min-h-9 shrink-0 items-center justify-between gap-2 border-t-2 border-gray-900 px-4 py-1.5 font-mono text-[10px] font-bold text-gray-600 dark:border-[#222B3D] dark:text-gray-400">
              <span className="truncate">ECONOVA // SPOTLIGHT SEARCH</span>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden sm:inline">↑↓ Navigate · ↵ Select · Esc</span>
                <span className="sm:hidden">↵ Select · Esc</span>
                {onOpenShortcuts && (
                  <button
                    type="button"
                    data-testid="command-bar-shortcuts-btn"
                    onClick={() => {
                      setIsExpanded(false);
                      onOpenShortcuts();
                    }}
                    className="inline-flex items-center gap-1 rounded border border-gray-900/30 bg-black/5 px-1.5 py-0.5 text-[10px] font-bold text-gray-800 transition-colors hover:border-[#5DE1D2] hover:text-black dark:border-[#222B3D] dark:bg-white/5 dark:text-gray-300 dark:hover:border-[#5DE1D2] dark:hover:text-[#5DE1D2]"
                  >
                    <Keyboard className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>Shift+?</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
