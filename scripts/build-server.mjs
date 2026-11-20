// Bundles server.ts (and the src/ + server/ modules it imports) into a single
// ESM file for the Vercel Serverless Function in api/index.js.
//
// Why a bundle: the codebase imports local files with `.ts` extensions
// (tsconfig `allowImportingTsExtensions`), which Node cannot resolve once Vercel
// compiles each file to .js. npm packages stay external; Vercel's file tracer
// picks them up from node_modules.
import { build } from 'esbuild';

await build({
  entryPoints: ['server.ts'],
  outfile: 'dist-server/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});
