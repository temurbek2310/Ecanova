## fix(auth): close account-takeover holes and remove mock guest session

### Why
An audit of the auth flow found that anyone could get a session for any account, and that a mock "Guest User" made every visitor appear signed in.

### Security fixes
- **Removed `POST /api/auth/google`**: it issued a session for any email in the request body without verifying it with Google.
- **OAuth callback** signs in only after a real code exchange that returns `email_verified: true`. The hardcoded fallback identity is gone.
- **Login-CSRF protection**: OAuth `state` is signed and bound to the browser through a short-lived HttpOnly nonce cookie.
- **Callback page**: the payload is escaped (no `</script>` breakout), `postMessage` targets the exact origin, and listeners accept only same-origin messages.
- **Cookie-only sessions**: HttpOnly, `SameSite=Lax`. Tokens are no longer returned in JSON or `X-Session-Token`. Legacy tokens in localStorage or the JS-readable cookie are purged on startup.
- **`SESSION_SECRET` is required in production**: the server refuses to start without it. Outside production the fallback secret is random per process.
- **Throttling**: failed logins are limited to 10 per email and 100 per IP per 15 minutes; registrations are capped per IP. Responses are 429 with `Retry-After`.

### Behaviour changes
- `/api/auth/me` returns `{ user: null }` when signed out. The mock guest user and token are deleted, and `/api/me/*` return 401 instead of guest data.
- `apiFetch` serves bundled data only for public GET endpoints on network errors, 404 or 5xx. It never does this for auth or learner data, or on 401/403.
- The route guard is enforced server-side using the verified session. The cached role is re-checked after `/api/auth/me` resolves.
- Course and lesson pages are consistently public, since guests keep progress locally.

### Heads-up
- **The demo auto-login ("pitch deck bypass") is gone.** Demo accounts need `ENABLE_DEMO_SANDBOX=true` and a database.
- **Set `SESSION_SECRET` before deploying**, or the server won't start.
- With cookie-only sessions, sign-in inside third-party iframes (e.g. the AI Studio preview) may fail where the browser blocks those cookies. Top-level deployments such as Cloud Run are unaffected.
- **Two limits remain:** the rate limiter is per process (use a shared store for multi-instance), and register still returns 409 for an existing email (it's rate-limited, but fully fixing that needs email verification).

### Testing
- `tsc --noEmit` is clean, and all 169 tests pass, including the new `server/auth.test.ts`.
- **Checked in the browser against the Express server:**
  - Signed out, `/profile` redirects to `/login?redirectTo=%2Fprofile`.
  - "Guest User" no longer appears.
  - A forged admin token is still redirected from `/admin`.
  - Opening `/auth/callback` directly returns 400 with no session.
  - The Google and email sign-in errors show cleanly.
- **Not tested:** a successful password login and a real Google sign-in (no database or OAuth keys locally).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
