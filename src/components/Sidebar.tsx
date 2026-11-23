'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { Flame, MessageSquare } from 'lucide-react';
import { useEconovaGSAP } from '../hooks/useEconovaGSAP';
import { getShortcutLabelForTab } from '../lib/keyboard-shortcuts';
import type { AdminSection, AppNavTab } from '../lib/auth-routing';
import type { LocaleCode } from '../shared/types';
import { FloatingWatermark } from './FloatingWatermark';
import { PWAInstallButton } from './PWAInstallButton';

export interface SidebarNavItem {
  id: AppNavTab;
  label: string;
  icon: React.ReactNode;
}

export interface SidebarAdminNav {
  heading: string;
  items: Array<{ section: AdminSection; label: string; icon: React.ReactNode }>;
  /** Highlighted admin page, or null when the admin console is not open. */
  activeSection: AdminSection | null;
  onNavigate: (section: AdminSection) => void;
}

export interface SidebarProps {
  activeTab: AppNavTab;
  /** Admin console links. Passed only for admins; learners never see it. */
  adminNav?: SidebarAdminNav | null;
  locale: LocaleCode;
  navItems: SidebarNavItem[];
  streakFlame: {
    isMilestoneGlowing: boolean;
    tooltip: string;
    streakDays: number;
  };
  installAppLabel: string;
  onNavigateTab: (tab: AppNavTab) => void;
  onOpenCompanion: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  adminNav = null,
  locale,
  navItems,
  streakFlame,
  installAppLabel,
  onNavigateTab,
  onOpenCompanion,
}) => {
  const sidebarRef = useRef<HTMLElement | null>(null);

  useEconovaGSAP(
    sidebarRef,
    () => {
      const sidebarEl = sidebarRef.current;
      if (!sidebarEl) return;

      const items = Array.from(
        sidebarEl.querySelectorAll<HTMLElement>('[data-sidebar-nav-item="true"]')
      );
      if (items.length === 0) return;

      // Clear any stale inline hover properties whenever activeTab updates
      items.forEach((item) => {
        gsap.set(item, {
          x: 0,
          clearProps: 'borderColor,backgroundColor,boxShadow,color',
        });
        const bar = item.querySelector<HTMLElement>('[data-sidebar-accent-bar="true"]');
        if (bar) {
          gsap.set(bar, { scaleY: 0, opacity: 0 });
        }
      });

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const mm = gsap.matchMedia();
      mm.add('(hover: hover) and (pointer: fine)', () => {
        const cleanups: Array<() => void> = [];

        items.forEach((item) => {
          const bar = item.querySelector<HTMLElement>('[data-sidebar-accent-bar="true"]');

          const handleMouseEnter = () => {
            if (!sidebarRef.current) return;
            const isActive = item.dataset.active === 'true';

            if (prefersReducedMotion) {
              if (bar) {
                gsap.set(bar, { scaleY: 1, opacity: 1 });
              }
              return;
            }

            const isDark =
              typeof document === 'undefined' ||
              !document.documentElement.classList.contains('light');

            gsap.to(item, {
              x: 6,
              duration: 0.2,
              ease: 'power2.out',
              overwrite: 'auto',
              ...(isDark
                ? (!isActive
                    ? {
                        borderColor: 'rgba(93, 225, 210, 0.6)',
                        backgroundColor: 'rgba(16, 21, 34, 0.6)',
                        color: '#F8FAFC',
                        boxShadow: '4px 4px 0px #000000',
                      }
                    : {
                        boxShadow: '6px 6px 0px #000000',
                      })
                : {}),
            });

            if (bar) {
              gsap.to(bar, {
                scaleY: 1,
                opacity: 1,
                duration: 0.2,
                ease: 'power2.out',
                overwrite: 'auto',
              });
            }
          };

          const handleMouseLeave = () => {
            if (!sidebarRef.current) return;
            const isActive = item.dataset.active === 'true';

            if (prefersReducedMotion) {
              if (bar) {
                gsap.set(bar, { scaleY: 0, opacity: 0 });
              }
              return;
            }

            const isDark =
              typeof document === 'undefined' ||
              !document.documentElement.classList.contains('light');

            gsap.to(item, {
              x: 0,
              duration: 0.25,
              ease: 'power2.out',
              overwrite: 'auto',
              ...(isDark
                ? (!isActive
                    ? {
                        borderColor: 'rgba(0, 0, 0, 0)',
                        backgroundColor: 'rgba(16, 21, 34, 0)',
                        boxShadow: '0px 0px 0px #000000',
                        onComplete: () => {
                          gsap.set(item, {
                            clearProps: 'borderColor,backgroundColor,boxShadow,color',
                          });
                        },
                      }
                    : {
                        onComplete: () => {
                          gsap.set(item, { clearProps: 'boxShadow' });
                        },
                      })
                : {}),
            });

            if (bar) {
              gsap.to(bar, {
                scaleY: 0,
                opacity: 0,
                duration: 0.25,
                ease: 'power2.out',
                overwrite: 'auto',
              });
            }
          };

          item.addEventListener('mouseenter', handleMouseEnter);
          item.addEventListener('mouseleave', handleMouseLeave);
          cleanups.push(() => {
            item.removeEventListener('mouseenter', handleMouseEnter);
            item.removeEventListener('mouseleave', handleMouseLeave);
          });
        });

        return () => {
          cleanups.forEach((fn) => fn());
        };
      });

      return () => {
        mm.revert();
      };
    },
    { dependencies: [activeTab, navItems.length] }
  );

  return (
    <aside
      ref={sidebarRef}
      data-testid="desktop-sidebar"
      aria-label="Primary Sidebar Navigation"
      className="no-print relative z-20 hidden md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:justify-between md:overflow-x-hidden md:overflow-y-auto border-r-2 border-slate-500 bg-white/25 backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/25 p-4"
    >
      <FloatingWatermark
        theme="sidebar"
        scopeRef={sidebarRef}
        parallaxMode="raf"
        testId="sidebar-floating-watermark"
      />

      <div className="relative z-10 space-y-6">
        <div className="px-2 pt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigateTab('overview')}
            className="inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-ink whitespace-nowrap rounded-lg px-2 py-1 -ml-2 transition-all hover:bg-slate-900/10 hover:text-slate-950 dark:hover:bg-white/5 dark:hover:text-ink"
          >
            <span
              className="inline-block h-3 w-3 rounded-xs border-2 border-theme-border bg-theme-accent"
              aria-hidden="true"
            />
            <span>ECONOVA</span>
          </button>
        </div>

        <nav aria-label="Section Navigation" className="space-y-1.5">
          {navItems.map((item) => {
            const isActive =
              activeTab === item.id || (item.id === 'catalog' && activeTab === 'course');
            const shortcut = getShortcutLabelForTab(item.id);
            return (
              <button
                key={item.id}
                type="button"
                data-sidebar-nav-item="true"
                data-sidebar-nav-id={item.id}
                data-active={isActive ? 'true' : 'false'}
                onClick={() => onNavigateTab(item.id)}
                aria-keyshortcuts={shortcut ? shortcut.toLowerCase() : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative z-10 flex w-full min-h-[42px] items-center justify-between gap-2 overflow-hidden rounded-lg border-2 px-3 py-2 text-sm font-semibold whitespace-nowrap backdrop-blur-md transition-all ${
                  isActive
                    ? 'border-theme-border bg-white/60 text-theme-accent shadow-brutal-sm hover:bg-white/90 hover:border-slate-800 hover:shadow-[4px_4px_0px_#090D16] dark:bg-[#080B14]/70 dark:hover:bg-[#080B14]/80'
                    : 'border-transparent text-muted hover:bg-slate-900/10 hover:border-slate-800 hover:text-slate-950 hover:shadow-[3px_3px_0px_#090D16] dark:hover:bg-transparent dark:hover:border-transparent dark:hover:text-ink'
                }`}
              >
                <span
                  data-sidebar-accent-bar="true"
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-1 origin-center rounded-r bg-[#5B21B6] dark:bg-[#5DE1D2] will-change-transform"
                  style={{ transform: 'scaleY(0)', opacity: 0 }}
                />

                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                  {item.id === 'overview' && (
                    <span
                      data-testid="nav-streak-flame"
                      data-glowing={streakFlame.isMilestoneGlowing ? 'true' : 'false'}
                      title={streakFlame.tooltip}
                      className={`inline-flex items-center gap-1 rounded-md border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold backdrop-blur-md transition-colors ${
                        streakFlame.isMilestoneGlowing
                          ? 'border-amber-400/70 bg-amber-400/15 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                          : 'border-slate-500 bg-white/55 text-muted dark:border-[#222B3D] dark:bg-[#080B14]/60'
                      }`}
                    >
                      <Flame
                        className={`h-3 w-3 shrink-0 ${
                          streakFlame.isMilestoneGlowing
                            ? 'fill-amber-400 text-amber-400 animate-pulse'
                            : 'text-muted'
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        {streakFlame.streakDays}
                        {locale === 'uz' ? ' kun' : 'd'}
                      </span>
                    </span>
                  )}
                </span>
                {shortcut && (
                  <kbd
                    aria-hidden="true"
                    className="hidden lg:inline-flex min-w-[20px] items-center justify-center rounded border-2 border-slate-500 bg-white/55 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted backdrop-blur-md group-hover:border-slate-800 group-hover:text-slate-950 dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:group-hover:border-[#222B3D] dark:group-hover:text-muted"
                  >
                    {shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </nav>

        {adminNav && adminNav.items.length > 0 && (
          <nav aria-label={adminNav.heading} data-testid="sidebar-admin-nav" className="space-y-1.5">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted">
              {adminNav.heading}
            </div>
            {adminNav.items.map((item) => {
              const isActive = adminNav.activeSection === item.section;
              return (
                <button
                  key={item.section}
                  type="button"
                  data-admin-nav-section={item.section}
                  onClick={() => adminNav.onNavigate(item.section)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full min-h-[38px] items-center gap-2.5 rounded-lg border-2 px-3 py-1.5 text-sm font-semibold whitespace-nowrap backdrop-blur-md transition-all ${
                    isActive
                      ? 'border-theme-border bg-white/60 text-theme-accent shadow-brutal-sm hover:bg-white/90 hover:border-slate-800 hover:shadow-[4px_4px_0px_#090D16] dark:bg-[#080B14]/70'
                      : 'border-transparent text-muted hover:bg-slate-900/10 hover:border-slate-800 hover:text-slate-950 hover:shadow-[3px_3px_0px_#090D16] dark:hover:text-ink dark:hover:bg-transparent dark:hover:border-transparent'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      <div className="relative z-10 space-y-3 border-t-2 border-theme-border pt-4">
        <button
          type="button"
          onClick={onOpenCompanion}
          className="flex w-full min-h-[40px] items-center gap-2.5 rounded-lg border-2 border-slate-500 bg-white/55 px-3 py-2 text-xs font-semibold text-ink shadow-brutal-sm backdrop-blur-md transition-all hover:bg-slate-900/10 hover:border-slate-900 hover:text-slate-950 hover:shadow-[3px_3px_0px_#090D16] dark:border-[#222B3D] dark:bg-[#080B14]/60 dark:hover:border-theme-accent dark:hover:bg-[#080B14]/80 dark:hover:text-ink"
        >
          <MessageSquare className="h-4 w-4 text-teal" aria-hidden="true" />
          <span>{locale === 'uz' ? 'O‘quv yordamchisi' : 'Study Companion'}</span>
        </button>

        <PWAInstallButton label={installAppLabel} />
      </div>
    </aside>
  );
};

export default Sidebar;
