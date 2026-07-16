import postgres from 'postgres'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.resolve(__dirname, '../../../supabase/migrations')

let _sql = null
let _migrationPromise = null

/**
 * Returns the singleton `postgres` (sql) connection pool instance.
 * Automatically runs schema migrations on first access.
 */
export function getDb() {
  if (_sql) return _sql

  let connectionString = process.env.SUPABASE || process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Missing SUPABASE or DATABASE_URL environment variable in server/.env')
  }

  // Normalize unencoded @ symbols inside password (e.g. EmailDiet@9026 -> EmailDiet%409026)
  const lastAtIndex = connectionString.lastIndexOf('@')
  const firstAtIndex = connectionString.indexOf('@')
  if (lastAtIndex > firstAtIndex && (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://'))) {
    const protoEnd = connectionString.indexOf('://') + 3
    const userInfo = connectionString.slice(protoEnd, lastAtIndex)
    const hostInfo = connectionString.slice(lastAtIndex)
    connectionString = connectionString.slice(0, protoEnd) + userInfo.replace(/@/g, '%40') + hostInfo
  }

  // Configure postgres client: use prepared statements by default unless connecting via PgBouncer transaction mode (port 6543) or explicitly disabled
  const usePreparedStatements = process.env.PG_PREPARE !== undefined
    ? process.env.PG_PREPARE !== 'false'
    : !connectionString.includes(':6543')

  _sql = postgres(connectionString, {
    prepare: usePreparedStatements,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {}, // suppress notice chatter
  })

  // Trigger migration in background or on startup
  if (!_migrationPromise) {
    _migrationPromise = migrate(_sql).catch(err => {
      console.error('⚠️ Supabase schema migration failed:', err.message)
    })
  }

  return _sql
}

/**
 * For unit testing: inject an in-memory or mock SQL connection pool.
 */
export function setDbForTesting(mockSql) {
  _sql = mockSql
}

/**
 * For unit testing: reset connection state after tests.
 */
export function resetDbForTesting() {
  _sql = null
  _migrationPromise = null
}

/**
 * Explicitly wait for database initialization and schema creation.
 */
export async function initDb() {
  const sql = getDb()
  if (_migrationPromise) {
    await _migrationPromise
  }
  return sql
}

async function migrate(sql) {
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    for (const file of files) {
      try {
        const ddl = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
        await sql.unsafe(ddl)
      } catch (err) {
        // Log migration execution error so schema failures are never silently hidden
        console.error(`⚠️ [DB Migration Error] Failed running ${file}:`, err.message)
      }
    }
  }
}

/**
 * Close the database connection pool (for graceful shutdown or testing).
 */
export async function closeDb() {
  if (_sql && typeof _sql.end === 'function') {
    await _sql.end()
  }
  _sql = null
  _migrationPromise = null
}
