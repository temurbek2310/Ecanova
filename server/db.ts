import fs from 'node:fs'
import path from 'node:path'
import { Pool, type PoolClient, type QueryResultRow } from 'pg'

export interface SqlExecutor {
	query<T extends QueryResultRow = Record<string, unknown>>(
		text: string,
		params?: unknown[],
	): Promise<T[]>
	queryOne<T extends QueryResultRow = Record<string, unknown>>(
		text: string,
		params?: unknown[],
	): Promise<T | null>
	execute(text: string, params?: unknown[]): Promise<number>
}

declare global {
	var _econovaPgPool: Pool | undefined
}

function resolveDbConnectionString(): string | null {
	const candidate = (
		process.env.SUPABASE_DB_URL ||
		process.env.DATABASE_URL ||
		''
	).trim()
	if (
		!candidate ||
		candidate === 'MY_DATABASE_URL' ||
		candidate.includes('USER:PASSWORD@HOST')
	) {
		return null
	}
	return candidate
}

let mockSqlExecutor: SqlExecutor | null = null

export function setMockSqlExecutor(mock: SqlExecutor | null): void {
	mockSqlExecutor = mock
}

export function isDatabaseConfigured(): boolean {
	return mockSqlExecutor !== null || resolveDbConnectionString() !== null
}

export function isSupabaseApiConfigured(): boolean {
	const url = (process.env.SUPABASE_URL || '').trim()
	const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
	return Boolean(url && key && !url.includes('YOUR_PROJECT'))
}

export function getPool(): Pool {
	if (!global._econovaPgPool) {
		const connectionString = resolveDbConnectionString()
		if (!connectionString) {
			throw new Error(
				'Supabase PostgreSQL connection is not configured. Set SUPABASE_DB_URL or DATABASE_URL in AI Studio Secrets.',
			)
		}
		const isLocalHost =
			connectionString.includes('localhost') ||
			connectionString.includes('127.0.0.1')

		global._econovaPgPool = new Pool({
			connectionString,
			max: process.env.VERCEL ? 2 : 5,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 10000,
			ssl: isLocalHost ? false : { rejectUnauthorized: false },
		})

		global._econovaPgPool.on('error', err => {
			console.error('Unexpected idle PostgreSQL client error:', err)
		})
	}
	return global._econovaPgPool
}

function wrapClient(client: PoolClient): SqlExecutor {
	return {
		async query<T extends QueryResultRow = Record<string, unknown>>(
			text: string,
			params: unknown[] = [],
		): Promise<T[]> {
			const res = await client.query<T>(text, params)
			return res.rows
		},
		async queryOne<T extends QueryResultRow = Record<string, unknown>>(
			text: string,
			params: unknown[] = [],
		): Promise<T | null> {
			const res = await client.query<T>(text, params)
			return res.rows[0] ?? null
		},
		async execute(text: string, params: unknown[] = []): Promise<number> {
			const res = await client.query(text, params)
			return res.rowCount ?? 0
		},
	}
}

export const db: SqlExecutor = {
	async query<T extends QueryResultRow = Record<string, unknown>>(
		text: string,
		params: unknown[] = [],
	): Promise<T[]> {
		if (mockSqlExecutor) return mockSqlExecutor.query<T>(text, params)
		const res = await getPool().query<T>(text, params)
		return res.rows
	},
	async queryOne<T extends QueryResultRow = Record<string, unknown>>(
		text: string,
		params: unknown[] = [],
	): Promise<T | null> {
		if (mockSqlExecutor) return mockSqlExecutor.queryOne<T>(text, params)
		const res = await getPool().query<T>(text, params)
		return res.rows[0] ?? null
	},
	async execute(text: string, params: unknown[] = []): Promise<number> {
		if (mockSqlExecutor) return mockSqlExecutor.execute(text, params)
		const res = await getPool().query(text, params)
		return res.rowCount ?? 0
	},
}

export async function runInTransaction<T>(
	fn: (tx: SqlExecutor) => Promise<T>,
): Promise<T> {
	if (mockSqlExecutor) {
		return fn(mockSqlExecutor)
	}
	const client = await getPool().connect()
	try {
		await client.query('BEGIN')
		const result = await fn(wrapClient(client))
		await client.query('COMMIT')
		return result
	} catch (err) {
		try {
			await client.query('ROLLBACK')
		} catch {
			// Ignore rollback error if connection dropped
		}
		throw err
	} finally {
		client.release()
	}
}

export async function applyMigrations(): Promise<string[]> {
	const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations')
	if (!fs.existsSync(migrationsDir)) {
		throw new Error('Migrations directory supabase/migrations not found.')
	}

	const files = fs
		.readdirSync(migrationsDir)
		.filter(f => f.endsWith('.sql'))
		.sort()

	const appliedNow: string[] = []

	await runInTransaction(async tx => {
		await tx.execute(`
      CREATE TABLE IF NOT EXISTS _econova_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

		const existing = await tx.query<{ id: string }>(
			'SELECT id FROM _econova_migrations',
		)
		const existingSet = new Set(existing.map(r => r.id))

		for (const file of files) {
			if (existingSet.has(file)) continue
			const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
			await tx.execute(sql)
			await tx.execute('INSERT INTO _econova_migrations (id) VALUES ($1)', [
				file,
			])
			appliedNow.push(file)
		}
	})

	return appliedNow
}
