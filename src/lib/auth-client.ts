import type { LocaleCode, UserSummary } from '../shared/types';
import {
  cleanOAuthUrlParams,
  isOAuthCallbackUrl,
  resolveDestinationFromPath,
  sanitizeRedirectTo,
  type IntendedDestination,
} from './auth-routing';
import { resolveMvpApiFallbackPayload } from './mvp-api-stubs';
import { normalizeUserRole } from '../shared/econova-rules';

/**
 * Session model: the server keeps the session in an HttpOnly `econova_session`
 * cookie that page scripts cannot read. The client never stores or sends the
 * raw token; it only caches a copy of the user profile for display, and that
 * copy is always re-checked against /api/auth/me before it is trusted.
 */
export const CACHED_USER_STORAGE_KEY = 'econova_cached_user';
export const INTENDED_DESTINATION_STORAGE_KEY = 'econova_intended_destination';

/** Storage key and cookie used by earlier builds that kept the token in JS-readable storage. */
const LEGACY_SESSION_TOKEN_STORAGE_KEY = 'econova_session_token';
const LEGACY_CLIENT_SESSION_COOKIE_NAME = 'econova_client_session';

let legacyCleanupDone = false;
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

/** Removes session tokens that earlier builds left in localStorage or a readable cookie. */
export function purgeLegacySessionToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(LEGACY_SESSION_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage restriction
  }
  try {
    document.cookie = `${LEGACY_CLIENT_SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    if (window.location.protocol === 'https:') {
      document.cookie = `${LEGACY_CLIENT_SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=None; Secure`;
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
      // Profiles cached by older builds may carry legacy staff roles.
      return { ...parsed, role: normalizeUserRole(parsed.role) };
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
  purgeLegacySessionToken();
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
 * Same-origin fetch wrapper: sends the HttpOnly session cookie and, for a small
 * set of public read-only endpoints, serves bundled offline data when the
 * server is unreachable or erroring. Auth and learner endpoints (/api/auth/*,
 * /api/me/*) never get substitute data, and 401/403 responses are always
 * passed through so the UI sees the real signed-out state.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const baseFetch = getNativeFetch();
  if (!isSameOriginApiUrl(input)) {
    return baseFetch(input, init);
  }

  const nextInit: RequestInit = {
    ...init,
    credentials: init?.credentials ?? 'same-origin',
  };

  const method = (
    init?.method ||
    (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
  ).toUpperCase();

  const offlineFallback = (): Response | null => {
    if (method !== 'GET') return null;
    let parsedUrl: URL;
    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      parsedUrl =
        input instanceof URL
          ? input
          : new URL(
              typeof Request !== 'undefined' && input instanceof Request ? input.url : String(input),
              origin
            );
    } catch {
      return null;
    }
    const fallback = resolveMvpApiFallbackPayload(parsedUrl.pathname, parsedUrl.searchParams);
    if (fallback === null) return null;
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Econova-Offline-Fallback': '1' },
    });
  };

  try {
    const response = await baseFetch(input, nextInit);
    if (response.status === 404 || response.status >= 500) {
      return offlineFallback() ?? response;
    }
    return response;
  } catch (err) {
    const fallback = offlineFallback();
    if (fallback) return fallback;
    throw err;
  }
}

/** Called once at startup: clears tokens that earlier builds stored where scripts could read them. */
export function installAuthFetchInterceptor(): void {
  if (typeof window === 'undefined' || legacyCleanupDone) {
    return;
  }
  legacyCleanupDone = true;
  purgeLegacySessionToken();
  getNativeFetch();
}

/** Parses a JSON body without throwing on empty or non-JSON error responses. */
export async function readJsonSafely<T>(response: Response): Promise<Partial<T>> {
  try {
    return (await response.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export type GoogleSignInStartResult = 'popup_opened' | 'not_configured' | 'popup_blocked' | 'failed';

const GOOGLE_POPUP_NAME = 'econova_google_oauth';

/**
 * Starts Google sign-in in a popup. Must be called directly from a click
 * handler: the popup is opened synchronously (before any await) so browsers
 * do not block it, then pointed at Google once the authorize URL is ready.
 * The result arrives later as a postMessage; see readOAuthPopupMessage.
 */
export async function startGooglePopupSignIn(
  redirectTo: string,
  locale: LocaleCode
): Promise<GoogleSignInStartResult> {
  const popup =
    typeof window !== 'undefined'
      ? window.open('', GOOGLE_POPUP_NAME, 'width=560,height=680')
      : null;
  try {
    const params = new URLSearchParams({
      redirectTo: sanitizeRedirectTo(redirectTo, '/overview'),
      locale,
      origin: window.location.origin,
    });
    const res = await apiFetch(`/api/auth/google/url?${params.toString()}`);
    const data = await readJsonSafely<{ configured: boolean; url: string | null }>(res);
    if (!res.ok || !data.configured || !data.url) {
      popup?.close();
      return res.ok ? 'not_configured' : 'failed';
    }
    if (!popup || popup.closed) {
      return 'popup_blocked';
    }
    popup.location.href = data.url;
    return 'popup_opened';
  } catch {
    popup?.close();
    return 'failed';
  }
}

export type OAuthPopupMessage =
  | { type: 'success'; user: UserSummary; redirectTo: string | null }
  | { type: 'error'; reason: string };

export const OAUTH_BROADCAST_CHANNEL = 'econova_oauth';
export const OAUTH_RESULT_STORAGE_KEY = 'econova_oauth_result';

export { cleanOAuthUrlParams, isOAuthCallbackUrl };

/**
 * Parses raw OAuth payload from postMessage, BroadcastChannel, or storage event.
 */
export function parseOAuthPayload(data: unknown): OAuthPopupMessage | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as {
    type?: string;
    user?: UserSummary;
    redirectTo?: string;
    reason?: string;
  };
  if (payload.type === 'OAUTH_AUTH_SUCCESS' && payload.user && typeof payload.user.id === 'string') {
    return {
      type: 'success',
      user: payload.user,
      redirectTo: payload.redirectTo ? sanitizeRedirectTo(payload.redirectTo, '/overview') : null,
    };
  }
  if (payload.type === 'OAUTH_AUTH_ERROR') {
    return { type: 'error', reason: typeof payload.reason === 'string' ? payload.reason : 'unknown' };
  }
  return null;
}

/**
 * Accepts OAuth results only from this app's own origin (the callback page is
 * served from the same origin and posts with an exact target origin).
 */
export function readOAuthPopupMessage(event: MessageEvent): OAuthPopupMessage | null {
  if (typeof window === 'undefined' || event.origin !== window.location.origin) {
    return null;
  }
  return parseOAuthPayload(event.data);
}

/**
 * Unified cross-window and cross-tab OAuth event subscriber.
 * Listens to:
 * 1. window.addEventListener('message') (popup postMessage)
 * 2. BroadcastChannel('econova_oauth') (works even when opener is severed by COOP)
 * 3. window.addEventListener('storage') (for fallback multi-tab updates)
 */
export function subscribeToOAuthEvents(
  onEvent: (message: OAuthPopupMessage) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleMessage = (event: MessageEvent) => {
    const msg = readOAuthPopupMessage(event);
    if (msg) onEvent(msg);
  };

  let broadcastChannel: BroadcastChannel | null = null;
  try {
    if (typeof window.BroadcastChannel === 'function') {
      broadcastChannel = new BroadcastChannel(OAUTH_BROADCAST_CHANNEL);
      broadcastChannel.onmessage = (event: MessageEvent) => {
        const msg = parseOAuthPayload(event.data);
        if (msg) onEvent(msg);
      };
    }
  } catch {
    // BroadcastChannel not supported or restricted
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== OAUTH_RESULT_STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as { payload?: unknown };
      const msg = parseOAuthPayload(parsed.payload ?? parsed);
      if (msg) {
        onEvent(msg);
      }
    } catch {
      // Ignore parse error
    }
  };

  window.addEventListener('message', handleMessage);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    try {
      broadcastChannel?.close();
    } catch {
      // Ignore close error
    }
  };
}
