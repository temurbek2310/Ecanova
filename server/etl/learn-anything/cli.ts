// CLI: npm run db:import:learn-anything -- --file <export.json> [options]
//
//   --file <path>              Local JSON export (see extract.ts for the format)
//   --url <url>                Fetch the JSON export over http(s) instead
//   --license <text>           Licence basis (overrides/fills source.license)
//   --attribution <text>       Attribution text (overrides/fills source.attribution)
//   --default-subject <s>      Economics | Mathematics | Business for unmatched topics
//   --triggered-by <user-id>   Recorded on the import_runs audit row
//   --dry-run                  Extract + transform and print the plan; no database access
//
// Everything is imported as 'draft' editions; nothing is published automatically.

import 'dotenv/config';
import { parseArgs } from 'node:util';
import type { Subject } from '../../../src/shared/types.ts';
import { applyMigrations, getPool, isDatabaseConfigured } from '../../db.ts';
import { ExtractError, extractFromFile, extractFromUrl, type SourceMetadata } from './extract.ts';
import { loadLearnAnything } from './load.ts';
import { transformLearnAnything } from './transform.ts';

const SUBJECTS: readonly Subject[] = ['Economics', 'Mathematics', 'Business'];

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      url: { type: 'string' },
      license: { type: 'string' },
      attribution: { type: 'string' },
      'default-subject': { type: 'string' },
      'triggered-by': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: true,
  });

  if (Boolean(values.file) === Boolean(values.url)) {
    console.error('Error: pass exactly one of --file <path> or --url <url>.');
    return 2;
  }
  const defaultSubject = values['default-subject'] as Subject | undefined;
  if (defaultSubject && !SUBJECTS.includes(defaultSubject)) {
    console.error(`Error: --default-subject must be one of ${SUBJECTS.join(', ')}.`);
    return 2;
  }

  const overrides: Partial<SourceMetadata> = {
    license: values.license,
    attribution: values.attribution,
  };
  const inputRef = (values.file ?? values.url)!;
  const data = values.file
    ? await extractFromFile(values.file, overrides)
    : await extractFromUrl(values.url!, overrides);

  const result = transformLearnAnything(data, { defaultSubject });
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);

  const editionCount = result.courses.reduce((n, c) => n + c.editions.length, 0);
  console.log(
    `Transformed ${result.courses.length} track(s) into ${editionCount} draft edition(s) ` +
      `from ${data.source.name} (licence: ${data.source.license}).`
  );

  if (values['dry-run']) {
    for (const course of result.courses) {
      const locales = course.editions.map((e) => e.locale.toUpperCase()).join(' + ');
      const lessons = course.editions[0].modules.reduce((n, m) => n + m.lessons.length, 0);
      console.log(`  ${course.slug} [${course.subject}] ${locales}: ${course.editions[0].modules.length} modules, ${lessons} lessons`);
    }
    console.log('Dry run: no database changes made.');
    return 0;
  }

  if (!isDatabaseConfigured()) {
    console.error('Error: SUPABASE_DB_URL or DATABASE_URL is not configured.');
    return 1;
  }

  try {
    const applied = await applyMigrations();
    if (applied.length) console.log('Applied migrations:', applied.join(', '));

    const out = await loadLearnAnything(result, { inputRef, triggeredBy: values['triggered-by'] ?? null });
    console.log(`Import run ${out.runId} succeeded:`, out.stats);
    for (const e of out.editions) {
      console.log(`  ${e.courseId} ${e.locale.toUpperCase()} v${e.version}: ${e.action}`);
    }
    return 0;
  } finally {
    await getPool().end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof ExtractError ? `Input error: ${err.message}` : err);
    process.exit(1);
  });
