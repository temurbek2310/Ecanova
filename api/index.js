// Vercel Serverless Function entry. vercel.json rewrites /api/* and
// /auth/callback here; Express sees the original path and routes it.
//
// dist-server/server.mjs is server.ts pre-bundled by `npm run build`
// (scripts/build-server.mjs). Importing it never calls listen(): with
// process.env.VERCEL set, server.ts only builds and exports the app.
// Plain JS on purpose: the project's TypeScript 7 has no JS compiler API for
// Vercel's Node builder to use.
import app from '../dist-server/server.mjs';

export default app;
