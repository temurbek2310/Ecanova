import {
  evaluateMiddlewareRouteGuard,
  resolveGuardRedirectTarget,
  withAccessNotice,
  type MiddlewareGuardDecision,
} from './lib/auth-routing';
import type { UserRole } from './shared/types';

export const SESSION_COOKIE_NAME = 'econova_session';

export interface MinimalMiddlewareRequest {
  url: string;
  nextUrl?: {
    pathname: string;
    search: string;
  };
  headers: {
    get(name: string): string | null;
  };
  cookies?: {
    get(name: string): { value: string } | undefined;
  };
}

export interface MiddlewareResult {
  status: number;
  redirectUrl: string | null;
  headers: Record<string, string>;
  decision: MiddlewareGuardDecision;
}

function parseCookieHeader(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex > 0) {
      const key = part.slice(0, eqIndex).trim();
      const val = part.slice(eqIndex + 1).trim();
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function decodeUnverifiedSessionPayload(
  token: string | null | undefined
): { userId: string; exp: number; role?: UserRole } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0]) return null;
  try {
    const json =
      typeof Buffer !== 'undefined'
        ? Buffer.from(parts[0], 'base64url').toString('utf8')
        : atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(json) as {
      userId?: string;
      exp?: number;
      role?: UserRole;
    };
    if (!parsed.userId || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return {
      userId: parsed.userId,
      exp: parsed.exp,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export function extractTokenFromMiddlewareRequest(
  req: MinimalMiddlewareRequest
): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const customHeader = req.headers.get('x-econova-session');
  if (customHeader?.trim()) {
    return customHeader.trim();
  }
  const directCookie = req.cookies?.get(SESSION_COOKIE_NAME)?.value;
  if (directCookie) {
    return directCookie;
  }
  const parsedCookies = parseCookieHeader(req.headers.get('cookie'));
  return parsedCookies[SESSION_COOKIE_NAME] || null;
}

/**
 * NOT AN AUTHORIZATION CHECK. This edge-style middleware has no access to the
 * session secret, so it only decodes the token payload without verifying its
 * signature; a forged token passes. It is suitable for UX hints (early
 * redirects, headers) only. The Express server enforces the real guard in
 * server.ts using the verified session from attachOptionalAuth.
 *
 * Next.js / Edge-compatible middleware that:
 * 1. Reads the active session cookie or Authorization header.
 * 2. Actively refreshes sessions approaching expiry on the response headers.
 * 3. Redirects unauthenticated visitors away from protected routes (see ROUTE_ACCESS_POLICIES
 *    in src/lib/auth-routing.ts) to `/login?redirectTo=<intended_destination>`.
 * 4. Redirects authenticated users away from `/login` and `/register` back to their intended destination.
 */
export function middleware(request: MinimalMiddlewareRequest): MiddlewareResult {
  const parsedUrl = new URL(request.url, 'http://localhost:3000');
  const pathname = request.nextUrl?.pathname ?? parsedUrl.pathname;
  const search = request.nextUrl?.search ?? parsedUrl.search;

  const rawToken = extractTokenFromMiddlewareRequest(request);
  const sessionPayload = decodeUnverifiedSessionPayload(rawToken);
  const isAuthenticated = Boolean(sessionPayload);

  const decision = evaluateMiddlewareRouteGuard({
    pathname,
    search,
    isAuthenticated,
    userRole: sessionPayload?.role ?? null,
  });

  const headers: Record<string, string> = {
    'x-econova-pathname': pathname,
    'x-econova-auth-status': isAuthenticated ? 'authenticated' : 'anonymous',
  };

  if (sessionPayload && rawToken) {
    headers['x-econova-user-id'] = sessionPayload.userId;
  }

  if (decision.action === 'redirect' && decision.destination) {
    const safeTarget = withAccessNotice(
      resolveGuardRedirectTarget(decision.destination),
      decision.reason
    );
    const redirectUrl = new URL(safeTarget, parsedUrl.origin).toString();
    return {
      status: 307,
      redirectUrl,
      headers: {
        ...headers,
        'Cache-Control': 'no-store',
        Location: redirectUrl,
      },
      decision,
    };
  }

  return {
    status: 200,
    redirectUrl: null,
    headers,
    decision,
  };
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
