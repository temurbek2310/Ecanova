import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setMockSqlExecutor, type SqlExecutor } from './db.ts';
import { seedIfEmpty } from './seed.ts';

function recordingExecutor(courseCount: number) {
  const statements: Array<{ text: string; params: unknown[] }> = [];
  const executor: SqlExecutor = {
    async query() {
      return [];
    },
    async queryOne<T>(text: string) {
      if (/COUNT\(\*\)/i.test(text)) return { cnt: courseCount } as T;
      return null;
    },
    async execute(text: string, params: unknown[] = []) {
      statements.push({ text, params });
      return 1;
    },
  };
  return { executor, statements };
}

const DEMO_MARKERS = ['user-dilnoza', 'user-azamat', 'user-malika', 'user-editor', 'ECO-DILNOZA', 'att-seed-'];

test('startup seed on an empty DB inserts curriculum but never demo learners', async () => {
  const { executor, statements } = recordingExecutor(0);
  setMockSqlExecutor(executor);
  try {
    await seedIfEmpty();
  } finally {
    setMockSqlExecutor(null);
  }
  assert.ok(statements.some((s) => /INSERT INTO courses/i.test(s.text)), 'curriculum is seeded');
  assert.ok(!statements.some((s) => /INSERT INTO users/i.test(s.text)), 'no users inserted');
  const serialized = JSON.stringify(statements);
  for (const marker of DEMO_MARKERS) {
    assert.ok(!serialized.includes(marker), `startup seed must not reference ${marker}`);
  }
});

test('startup seed is a no-op when curriculum already exists', async () => {
  const { executor, statements } = recordingExecutor(4);
  setMockSqlExecutor(executor);
  try {
    await seedIfEmpty();
  } finally {
    setMockSqlExecutor(null);
  }
  assert.equal(statements.length, 0);
});

test('production server never imports the demo seed', () => {
  const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.ok(!serverSource.includes('seed-demo'), 'server.ts must not import seed-demo');
});
