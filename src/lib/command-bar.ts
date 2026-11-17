import type { CourseCatalogItem, LocaleCode } from '../shared/types';
import type { AppNavTab } from './auth-routing';
import type { ThemeMode } from './theme';

export type CommandBarActionCategory = 'navigation' | 'course' | 'preferences';

export interface CommandBarActionItem {
  id: string;
  category: CommandBarActionCategory;
  label: string;
  subtitle: string;
  shortcutHint?: string;
  keywords: string[];
  kind:
    | { type: 'navigate'; tab: AppNavTab }
    | { type: 'open-course'; courseId: string }
    | { type: 'jump-section'; sectionId: 'economics' | 'mathematics' | 'business' }
    | { type: 'toggle-locale'; nextLocale: LocaleCode }
    | { type: 'toggle-theme'; nextTheme: ThemeMode }
    | { type: 'open-shortcuts' };
}

export interface CommandBarGeometry {
  width: number;
  height: number;
  borderRadius: number;
}

export const COMMAND_BAR_COMPACT_GEOMETRY: CommandBarGeometry = {
  width: 120,
  height: 40,
  borderRadius: 20,
};

export const COMMAND_BAR_MOBILE_COMPACT_GEOMETRY: CommandBarGeometry = {
  width: 40,
  height: 40,
  borderRadius: 20,
};

export const COMMAND_BAR_EXPANDED_MAX_WIDTH = 600;
export const COMMAND_BAR_EXPANDED_MAX_HEIGHT = 400;
export const COMMAND_BAR_EXPANDED_BORDER_RADIUS = 14;

export function getCommandBarGeometry(
  isExpanded: boolean,
  viewportWidth: number,
  viewportHeight: number
): CommandBarGeometry {
  if (!isExpanded) {
    if (viewportWidth > 0 && viewportWidth < 768) {
      return COMMAND_BAR_MOBILE_COMPACT_GEOMETRY;
    }
    return COMMAND_BAR_COMPACT_GEOMETRY;
  }

  return {
    width: Math.min(COMMAND_BAR_EXPANDED_MAX_WIDTH, Math.max(280, viewportWidth - 24)),
    height: Math.min(COMMAND_BAR_EXPANDED_MAX_HEIGHT, Math.max(260, viewportHeight - 32)),
    borderRadius: COMMAND_BAR_EXPANDED_BORDER_RADIUS,
  };
}

export function isCommandBarShortcutEvent(params: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
}): boolean {
  if (params.altKey || params.repeat) return false;
  const hasPrimaryMod = Boolean(params.metaKey || params.ctrlKey);
  if (!hasPrimaryMod) return false;
  return (params.key || '').trim().toLowerCase() === 'k';
}

export function buildCommandBarActions(params: {
  locale: LocaleCode;
  theme: ThemeMode;
  courses: CourseCatalogItem[];
}): CommandBarActionItem[] {
  const { locale, theme, courses } = params;
  const isUz = locale === 'uz';
  const nextLocale: LocaleCode = isUz ? 'en' : 'uz';
  const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';

  // Find a flagship Economics/Macroeconomics course if available
  const macroCourse = courses.find((c) => {
    const title = (c.editions[locale]?.title || c.editions.en?.title || c.slug).toLowerCase();
    return c.subject === 'Economics' || title.includes('macro') || title.includes('supply');
  });

  const actions: CommandBarActionItem[] = [
    {
      id: 'switch-locale',
      category: 'preferences',
      label: isUz ? 'Ingliz tiliga o‘tkazish' : "Translate to O'zbek",
      subtitle: isUz
        ? 'Platforma tilini ingliz tiliga almashtirish'
        : 'Switch interface and course editions to Uzbek',
      shortcutHint: isUz ? 'EN' : "O'Z",
      keywords: [
        'translate',
        'uzbek',
        'ozbek',
        "o'zbek",
        'o‘zbek',
        'english',
        'language',
        'til',
        'locale',
        'switch',
      ],
      kind: { type: 'toggle-locale', nextLocale },
    },
    {
      id: 'jump-macroeconomics',
      category: 'course',
      label: isUz ? 'Makroiqtisodiyot bo‘limiga o‘tish' : 'Jump to Macroeconomics',
      subtitle: macroCourse
        ? macroCourse.editions[locale]?.title || macroCourse.editions.en?.title || 'Economics Track'
        : isUz
        ? 'Iqtisodiyot bo‘limi va muvozanat modellari'
        : 'Market equilibrium, policy & macro flows',
      shortcutHint: 'ECON',
      keywords: ['macro', 'macroeconomics', 'economics', 'supply', 'demand', 'iqtisodiyot', 'jump'],
      kind: macroCourse
        ? { type: 'open-course', courseId: macroCourse.id }
        : { type: 'jump-section', sectionId: 'economics' },
    },
    {
      id: 'view-dashboard',
      category: 'navigation',
      label: isUz ? 'Boshqaruv panelini ochish' : 'View Dashboard',
      subtitle: isUz
        ? 'Kunlik maqsad, zaif nuqtalar radari va bo‘limlar'
        : 'Overview, weakness radar & study streak metrics',
      shortcutHint: 'G',
      keywords: ['dashboard', 'overview', 'home', 'panel', 'boshqaruv', 'weakness', 'radar'],
      kind: { type: 'navigate', tab: 'overview' },
    },
    {
      id: 'browse-catalog',
      category: 'navigation',
      label: isUz ? 'Kurslar katalogini ko‘rish' : 'Browse Courses',
      subtitle: isUz
        ? 'Iqtisodiyot, matematika va biznes kurslari'
        : 'Filter published Economics, Math & Business tracks',
      shortcutHint: 'C',
      keywords: ['courses', 'catalog', 'katalog', 'kurslar', 'search'],
      kind: { type: 'navigate', tab: 'catalog' },
    },
    {
      id: 'toggle-theme',
      category: 'preferences',
      label:
        nextTheme === 'light'
          ? isUz
            ? 'Yorug‘ rejimga o‘tish'
            : 'Switch to Light Mode'
          : isUz
          ? 'Tungi rejimga o‘tish'
          : 'Switch to Dark Mode',
      subtitle: isUz
        ? 'Neobrutalist rang mavzusini almashtirish'
        : 'Toggle Glass-Brutalist surface palette',
      shortcutHint: nextTheme === 'light' ? 'LIGHT' : 'DARK',
      keywords: ['theme', 'dark', 'light', 'mode', 'mavzu', 'tun', 'yorug'],
      kind: { type: 'toggle-theme', nextTheme },
    },
    {
      id: 'view-profile',
      category: 'navigation',
      label: isUz ? 'Profil va sozlamalar' : 'Profile & Preferences',
      subtitle: isUz
        ? 'Hisob qaydlari, tizim mavzusi va maxfiylik'
        : 'Account settings, OS theme sync & privacy',
      shortcutHint: 'P',
      keywords: ['profile', 'settings', 'privacy', 'profil', 'sozlamalar'],
      kind: { type: 'navigate', tab: 'profile' },
    },
  ];

  // Append individual course items (deduped against macroCourse already featured above)
  for (const course of courses) {
    if (macroCourse && course.id === macroCourse.id) continue;
    const ed = course.editions[locale] ?? course.editions.en;
    const title = ed?.title || course.slug;
    actions.push({
      id: `course-${course.id}`,
      category: 'course',
      label: title,
      subtitle: `${course.subject} · ${course.level} · ${course.estimatedMinutes} min`,
      shortcutHint: course.subject.slice(0, 4).toUpperCase(),
      keywords: [
        title.toLowerCase(),
        course.subject.toLowerCase(),
        course.level.toLowerCase(),
        ...(course.topicTags ?? []).map((tag) => tag.toLowerCase()),
      ],
      kind: { type: 'open-course', courseId: course.id },
    });
  }

  return actions;
}

export function filterCommandBarActions(
  actions: readonly CommandBarActionItem[],
  query: string
): CommandBarActionItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return actions.slice(0, 6);
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return actions
    .filter((item) => {
      const haystack = `${item.label} ${item.subtitle} ${item.keywords.join(' ')}`.toLowerCase();
      return tokens.every((tok) => haystack.includes(tok));
    })
    .slice(0, 6);
}
