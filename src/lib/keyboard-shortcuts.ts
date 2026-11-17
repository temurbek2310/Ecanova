export type ShortcutNavTab =
  | 'overview'
  | 'catalog'
  | 'achievements'
  | 'community'
  | 'certificates'
  | 'profile'
  | 'admin';

export interface NavShortcutRule {
  key: string;
  label: string;
  tab: ShortcutNavTab;
  requiresStaff?: boolean;
}

export const NAV_SHORTCUT_RULES: readonly NavShortcutRule[] = [
  { key: 'g', label: 'G', tab: 'overview' },
  { key: 'c', label: 'C', tab: 'catalog' },
  { key: 'x', label: 'X', tab: 'achievements' },
  { key: 'l', label: 'L', tab: 'community' },
  { key: 'v', label: 'V', tab: 'certificates' },
  { key: 'p', label: 'P', tab: 'profile' },
  { key: 'a', label: 'A', tab: 'admin', requiresStaff: true },
];

export function getShortcutLabelForTab(tab: string): string | null {
  const match = NAV_SHORTCUT_RULES.find((rule) => rule.tab === tab);
  return match ? match.label : null;
}

export function isEditableElementTarget(
  target: { tagName?: string | null; isContentEditable?: boolean } | null | undefined
): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function resolveNavigationShortcut(params: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  defaultPrevented?: boolean;
  isEditableTarget?: boolean;
  hasOpenDialog?: boolean;
  isStaff?: boolean;
}): ShortcutNavTab | null {
  if (
    params.ctrlKey ||
    params.metaKey ||
    params.altKey ||
    params.repeat ||
    params.defaultPrevented ||
    params.isEditableTarget ||
    params.hasOpenDialog
  ) {
    return null;
  }

  const normalizedKey = params.key.trim().toLowerCase();
  if (!normalizedKey) return null;

  const match = NAV_SHORTCUT_RULES.find((rule) => rule.key === normalizedKey);
  if (!match) return null;
  if (match.requiresStaff && !params.isStaff) return null;
  return match.tab;
}

export interface ShortcutCheatSheetItem {
  id: string;
  keys: string[];
  category: 'navigation' | 'workspace';
  title: string;
  description: string;
  targetTab?: ShortcutNavTab;
}

/**
 * Detects whether a keyboard event is the 'Shift + ?' shortcut to toggle the Cheat Sheet modal.
 */
export function isCheatSheetShortcutEvent(params: {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  defaultPrevented?: boolean;
  isEditableTarget?: boolean;
}): boolean {
  if (
    params.ctrlKey ||
    params.metaKey ||
    params.altKey ||
    params.repeat ||
    params.defaultPrevented ||
    params.isEditableTarget
  ) {
    return false;
  }

  const rawKey = (params.key || '').trim();
  if (rawKey === '?') return true;
  if (params.shiftKey && rawKey === '/') return true;
  return false;
}

/**
 * Builds the localized list of keyboard shortcuts displayed in the 'Shift + ?' Cheat Sheet modal.
 */
export function getKeyboardShortcutCheatSheet(
  locale: 'en' | 'uz' = 'en',
  isStaff = false
): ShortcutCheatSheetItem[] {
  const isUz = locale === 'uz';
  const items: ShortcutCheatSheetItem[] = [
    {
      id: 'nav-overview',
      keys: ['G'],
      category: 'navigation',
      title: isUz ? 'Umumiy ko‘rinish (Overview)' : 'Go to Overview Dashboard',
      description: isUz
        ? 'Asosiy o‘quv paneli, kunlik maqsad va zaif mavzular tahliliga o‘tish'
        : 'Jump to your study dashboard, daily goal ring, and Weakness Detection card',
      targetTab: 'overview',
    },
    {
      id: 'nav-catalog',
      keys: ['C'],
      category: 'navigation',
      title: isUz ? 'Kurslar katalogi (Catalog)' : 'Open Course Catalog',
      description: isUz
        ? 'Iqtisodiyot, Matematika va Biznes kurslarini qidirish va filtrlash'
        : 'Browse and filter Economics, Mathematics, and Business courses',
      targetTab: 'catalog',
    },
    {
      id: 'nav-profile',
      keys: ['P'],
      category: 'navigation',
      title: isUz ? 'Profil va sozlamalar (Profile)' : 'Open Profile & Settings',
      description: isUz
        ? 'OS mavzu sinxronizatsiyasi, haftalik xulosa va saqlangan kurslarni boshqarish'
        : 'Manage OS theme sync, Weekly Study Digest, and bookmarked courses',
      targetTab: 'profile',
    },
    {
      id: 'nav-achievements',
      keys: ['X'],
      category: 'navigation',
      title: isUz ? 'Yutuqlar va XP (Achievements)' : 'Open Achievements & XP',
      description: isUz
        ? 'O‘quv davomiyligi, nishonlar va naqd pulsiz XP daftarini ko‘rish'
        : 'Inspect your study streak, badges, and append-only non-cash XP ledger',
      targetTab: 'achievements',
    },
    {
      id: 'nav-community',
      keys: ['L'],
      category: 'navigation',
      title: isUz ? 'Jamiyat va reyting (Community)' : 'Open Community & Leaderboards',
      description: isUz
        ? 'Haftalik XP va test peshqadamlari jadvalini ko‘rish'
        : 'View weekly XP cohort standings and course quiz leaderboards',
      targetTab: 'community',
    },
    {
      id: 'nav-certificates',
      keys: ['V'],
      category: 'navigation',
      title: isUz ? 'Sertifikatlar (Certificates)' : 'Open Certificates & Verification',
      description: isUz
        ? 'Sertifikatlarni PDF yoki JSON formatida yuklab olish va tekshirish'
        : 'Verify and export your earned course certificates as PDF or JSON',
      targetTab: 'certificates',
    },
    {
      id: 'ws-cheatsheet',
      keys: ['Shift', '?'],
      category: 'workspace',
      title: isUz ? 'Klaviatura tugmalari jadvali' : 'Toggle Keyboard Shortcuts Cheat Sheet',
      description: isUz
        ? 'Barcha mavjud tezkor tugmalar oynasini ochish yoki yopish'
        : 'Open or close this interactive keyboard shortcut reference modal',
    },
    {
      id: 'ws-escape',
      keys: ['Esc'],
      category: 'workspace',
      title: isUz ? 'Faol oynani yopish' : 'Dismiss Active Modal or Drawer',
      description: isUz
        ? 'Ochiq modal oyna, Tezkor qaydlar yoki qidiruv ro‘yxatini yopish'
        : 'Close any open modal dialog, Quick Notes drawer, or dropdown',
    },
  ];

  if (isStaff) {
    items.splice(6, 0, {
      id: 'nav-admin',
      keys: ['A'],
      category: 'navigation',
      title: isUz ? 'Tahririyat studiyasi (Editorial Studio)' : 'Open Editorial Studio',
      description: isUz
        ? 'Ekspert ko‘rib chiqish so‘rovlari va kurs nashrlarini boshqarish'
        : 'Review student segment questions and manage course editions',
      targetTab: 'admin',
    });
  }

  return items;
}

