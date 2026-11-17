export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'econova_theme';

export function resolveInitialTheme(storedValue: string | null | undefined): ThemeMode {
  return storedValue === 'light' ? 'light' : 'dark';
}

export function getNextTheme(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}

export function applyDocumentTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.dataset.theme = theme;

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const canvasColor = window
      .getComputedStyle(root)
      .getPropertyValue('--econova-canvas')
      .trim();
    if (canvasColor) {
      metaTheme.setAttribute('content', canvasColor);
    }
  }
}

export function readActiveDocumentTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'dark';
  const root = document.documentElement;
  if (root.dataset.theme === 'light' || root.classList.contains('light')) {
    return 'light';
  }
  return 'dark';
}

export function observeDocumentTheme(onThemeChange: (theme: ThemeMode) => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }
  const root = document.documentElement;
  const observer = new MutationObserver(() => {
    onThemeChange(readActiveDocumentTheme());
  });
  observer.observe(root, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  });
  return () => observer.disconnect();
}

export function loadSavedTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    return resolveInitialTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'dark';
  }
}

export function saveThemePreference(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage quota / private mode restrictions
  }
}

export const THEME_SYNC_OS_STORAGE_KEY = 'econova_theme_sync_os';

export function resolveThemeSyncOsFlag(storedValue: string | null | undefined): boolean {
  return storedValue === 'true' || storedValue === '1';
}

export function detectSystemColorScheme(
  matchMediaFn?: ((query: string) => { matches: boolean }) | null
): ThemeMode {
  const matcher =
    matchMediaFn ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia.bind(window)
      : null);
  if (!matcher) return 'dark';
  try {
    return matcher('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function resolveEffectiveTheme(params: {
  manualTheme: ThemeMode;
  syncWithOs: boolean;
  systemTheme: ThemeMode;
}): ThemeMode {
  return params.syncWithOs ? params.systemTheme : params.manualTheme;
}

export function loadSavedThemeSyncOs(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return resolveThemeSyncOsFlag(window.localStorage.getItem(THEME_SYNC_OS_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function saveThemeSyncOsPreference(syncWithOs: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_SYNC_OS_STORAGE_KEY, syncWithOs ? 'true' : 'false');
  } catch {
    // Ignore storage quota / private mode restrictions
  }
}

export function subscribeToSystemColorScheme(
  onSystemThemeChange: (systemTheme: ThemeMode) => void
): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  try {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const listener = (event: MediaQueryListEvent | MediaQueryList) => {
      onSystemThemeChange(event.matches ? 'light' : 'dark');
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    }
    if (typeof mql.addListener === 'function') {
      mql.addListener(listener);
      return () => mql.removeListener(listener);
    }
  } catch {
    // Ignore unsupported media query listener environments
  }
  return () => {};
}

