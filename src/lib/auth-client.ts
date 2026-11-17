import type { UserSummary } from '../shared/types';
import {
  resolveDestinationFromPath,
  sanitizeRedirectTo,
  type IntendedDestination,
} from './auth-routing';

export const SESSION_TOKEN_STORAGE_KEY = 'econova_session_token';
export const CACHED_USER_STORAGE_KEY = 'econova_cached_user';
export const INTENDED_DESTINATION_STORAGE_KEY = 'econova_intended_destination';
export const CLIENT_SESSION_COOKIE_NAME = 'econova_client_session';

let inMemorySessionToken: string | null = null;
let fetchInterceptorInstalled = false;
let nativeFetchRef: typeof fetch | null = null;

function getNativeFetch(): typeof fetch {
  if (nativeFetchRef) {
    return nativeFetchRef;
  }
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    nativeFetchRef = window.fetch.bind(window);
    return nativeFetchRef;
  }
  return globalThis.fetch.bind(globalThis);
}

export function getStoredSessionToken(): string | null {
  if (inMemorySessionToken) {
    return inMemorySessionToken;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const fromStorage = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (fromStorage && fromStorage.trim()) {
      inMemorySessionToken = fromStorage.trim();
      return inMemorySessionToken;
    }
  } catch {
    // Ignore storage restriction
  }
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${CLIENT_SESSION_COOKIE_NAME}=([^;]+)`)
    );
    if (match?.[1]) {
      inMemorySessionToken = decodeURIComponent(match[1]);
      return inMemorySessionToken;
    }
  } catch {
    // Ignore cookie error
  }
  return null;
}

export function persistSessionToken(token: string | null | undefined): void {
  const clean = typeof token === 'string' && token.trim() ? token.trim() : null;
  inMemorySessionToken = clean;
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (clean) {
      window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, clean);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage error
  }
  try {
    const isSecure = window.location.protocol === 'https:';
    const sameSite = isSecure ? 'None; Secure' : 'Lax';
    if (clean) {
      document.cookie = `${CLIENT_SESSION_COOKIE_NAME}=${encodeURIComponent(
        clean
      )}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=${sameSite}`;
    } else {
      document.cookie = `${CLIENT_SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=${sameSite}`;
    }
  } catch {
    // Ignore cookie error
  }
}

export function getCachedUserSummary(): UserSummary | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CACHED_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserSummary;
    if (parsed && typeof parsed.id === 'string' && typeof parsed.email === 'string') {
      return parsed;
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export function persistCachedUserSummary(user: UserSummary | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (user) {
      window.localStorage.setItem(CACHED_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(CACHED_USER_STORAGE_KEY);
    }
  } catch {
    // Ignore storage error
  }
}

export function clearClientSessionState(): void {
  persistSessionToken(null);
  persistCachedUserSummary(null);
}

export function saveIntendedDestination(dest: IntendedDestination | string): void {
  const resolved: IntendedDestination =
    typeof dest === 'string'
      ? resolveDestinationFromPath(dest)
      : {
          ...dest,
          path: sanitizeRedirectTo(dest.path, '/overview'),
        };
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(INTENDED_DESTINATION_STORAGE_KEY, JSON.stringify(resolved));
  } catch {
    // Ignore storage error
  }
}

export function peekIntendedDestination(): IntendedDestination | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(INTENDED_DESTINATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntendedDestination;
    if (parsed && typeof parsed.tab === 'string' && typeof parsed.path === 'string') {
      return {
        ...parsed,
        path: sanitizeRedirectTo(parsed.path, '/overview'),
      };
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export function consumeIntendedDestination(): IntendedDestination | null {
  const current = peekIntendedDestination();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(INTENDED_DESTINATION_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
  }
  return current;
}

function isSameOriginApiUrl(input: RequestInfo | URL): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (typeof input === 'string') {
      if (input.startsWith('/api/') || input === '/api' || input.startsWith('/auth/')) {
        return true;
      }
      if (input.startsWith(window.location.origin)) {
        const path = input.slice(window.location.origin.length);
        return path.startsWith('/api/') || path.startsWith('/auth/');
      }
      return false;
    }
    if (input instanceof URL) {
      return (
        input.origin === window.location.origin &&
        (input.pathname.startsWith('/api/') || input.pathname.startsWith('/auth/'))
      );
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return isSameOriginApiUrl(input.url);
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Authenticated fetch wrapper that attaches the active session token via
 * Authorization: Bearer and X-Econova-Session headers and rotates the local
 * session token when the server returns an updated X-Session-Token header.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const baseFetch = getNativeFetch();
  if (!isSameOriginApiUrl(input)) {
    return baseFetch(input, init);
  }

  const token = getStoredSessionToken();
  const headers = new Headers(
    init?.headers ||
      (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
  );

  if (token) {
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('X-Econova-Session')) {
      headers.set('X-Econova-Session', token);
    }
  }

  const nextInit: RequestInit = {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
  };

  const response = await baseFetch(input, nextInit);

  const rotatedToken = response.headers.get('X-Session-Token');
  if (rotatedToken !== null) {
    if (rotatedToken.trim()) {
      persistSessionToken(rotatedToken.trim());
    }
  }

  return response;
}

export function installAuthFetchInterceptor(): void {
  if (typeof window === 'undefined' || fetchInterceptorInstalled) {
    return;
  }
  fetchInterceptorInstalled = true;
  getNativeFetch();
}

