# ECONOVA — Bilingual Learning PWA

ECONOVA is a dark-mode-first, bilingual (English and Uzbek Latin) Progressive Web App for **Economics**, **Mathematics**, and **Business** across **Beginner**, **Intermediate**, and **Advanced** course levels (`Progressing` is tracked strictly as a learner journey status).

## Implemented Capabilities
- **PWA Foundation (`vite-plugin-pwa`)**: Web App Manifest (`standalone`), PNG/SVG icons (`192x192`, `512x512`, `maskable`, `apple-touch-icon.png`), in-app install button, offline connectivity banner, and safe Workbox caching (private `/api/me/*`, `/api/admin/*`, `/api/auth/*`, and `/api/ai/*` routes are strictly `NetworkOnly`).
- **Bilingual Catalog & Courses**: Separately authored and reviewed English (`en`) and Uzbek Latin (`uz`) editions with zero silent machine-translation fallback.
- **Interactive Lessons & Accessibility**: Structured lesson blocks, live interactive SVG models (Supply & Demand equilibrium, Calculus tangent slope, Unit Economics LTV/CAC), audio narration with speed control, toggleable VTT captions, full transcripts, source provenance, and learner issue reporting.
- **Server-Verified Assessment & Course Certificates**: Answer keys stay on the server; submissions enforce daily retry limits, compute scores server-side, issue at most one verifiable certificate per course/version, include scannable verification QR codes, support consent-preview sharing + revocation, and expose minimal public verification at `/?verify=<token>` or `/api/verify/:token`.
- **Non-Cash XP, Streaks, Badges, Opt-In Leaderboard & Referrals**: Append-only `xp_ledger` with idempotency keys and daily caps (`300 XP/day`), timezone-aware streaks, opt-in pseudonym cohort rankings, and anti-self-referral claims. No cash withdrawal or monetary conversion exists.
- **Editorial Governance & Optional AI Draft Studio**: Enforces sequential human sign-offs (`Draft -> Subject Review -> Language Review -> Rights & Accessibility -> Approved -> Published`) plus certificate revocation and issue triage. Optional server-side Gemini drafting (`@google/genai`) stays disabled until `GEMINI_API_KEY` is configured in Secrets, and all AI outputs remain in `Draft` status.
- **PostgreSQL + RLS Persistence (`supabase/migrations/`)**: All relational schema, constraints, idempotency keys, and Row-Level Security (RLS) policies live in `supabase/migrations/0001_initial_schema.sql` and `0002_rls_policies.sql`. Answer keys (`questions.correct_option_index`) are blocked from non-staff direct database access and never leave the server.

## Required Secrets & Scripts
1. Configure required secrets in **AI Studio Settings > Secrets** (or Cloud Run Secret Manager — never commit `.env` or expose keys in `VITE_*` browser variables):
   - `SUPABASE_DB_URL` — PostgreSQL connection string (`postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require`).
   - `SESSION_SECRET` — random 64-character hex string (32+ bytes) used to sign `HttpOnly` session cookies.
   - `GEMINI_API_KEY` *(optional)* — enables server-side Study Companion and Editorial Draft visual generation; kept disabled when unset.
2. `npm run db:migrate` — applies SQL migrations in `supabase/migrations/*.sql` idempotently.
3. `npm run db:seed` — seeds bilingual Economics, Mathematics, and Business curriculum into PostgreSQL (curriculum only; the server also runs this automatically on an empty database and never creates user accounts).
   - `npm run db:import:learn-anything -- --file data/learn-anything-production.json` — imports the extended ETL curriculum as **draft** editions; publish them through the admin console.
   - `npm run db:seed:demo` *(local/staging only)* — adds a demo learner cohort (XP, streaks, weekly quiz attempts) for UI testing. Refuses to run with `NODE_ENV=production`; add `-- --staff` for a demo admin.
4. `npm run dev` — starts `server.ts` (Express API + Vite middleware on port 3000).
5. `npm test` — runs deterministic unit tests (`src/shared/econova-rules.test.ts`).
6. `npm run build` — builds production client bundle into `dist/`.
7. `npm start` — starts production server via `node server.ts`.

See `DECISIONS.md` for architecture notes and defaults selected for open product questions in `DOIT_v2.md`.
