import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { config } from '../config.js'

let _db = null

/**
 * Returns the singleton SQLite database instance.
 * Creates the database file and schema on first call.
 */
export function getDb() {
  if (_db) return _db

  // Ensure data directory exists
  const dbDir = path.dirname(config.dbPath)
  fs.mkdirSync(dbDir, { recursive: true })

  _db = new Database(config.dbPath)

  // WAL mode for better concurrent read performance
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  // Run schema migration
  migrate(_db)

  return _db
}

function migrate(db) {
  db.exec(`
    -- Core user identity (populated from Google profile on first login)
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      display_name  TEXT,
      avatar_url    TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    -- Encrypted Gmail OAuth tokens per user
    CREATE TABLE IF NOT EXISTS tokens (
      user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      encrypted     TEXT NOT NULL,
      iv            TEXT NOT NULL,
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    -- Per-user preferences
    CREATE TABLE IF NOT EXISTS preferences (
      user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      scan_max_messages   INTEGER,
      default_time_range  TEXT DEFAULT '3m',
      label_prefix        TEXT DEFAULT 'Unsub/',
      digest_enabled      INTEGER DEFAULT 0,
      digest_day          INTEGER NOT NULL DEFAULT 1,
      digest_hour         INTEGER NOT NULL DEFAULT 8,
      digest_recipient    TEXT NOT NULL DEFAULT ''
    );

    -- Per-user protected senders
    CREATE TABLE IF NOT EXISTS protected_senders (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email     TEXT NOT NULL,
      domain    TEXT,
      source    TEXT DEFAULT 'manual',
      added_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, email)
    );

    -- Per-user label registry
    CREATE TABLE IF NOT EXISTS label_registry (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label_name  TEXT NOT NULL,
      gmail_id    TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, label_name)
    );

    -- Activity audit log
    CREATE TABLE IF NOT EXISTS activity_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action      TEXT NOT NULL,
      details     TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Digest baseline per user
    CREATE TABLE IF NOT EXISTS digest_baseline (
      user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      senders     TEXT,
      last_run_at TEXT,
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_protected_senders_user ON protected_senders(user_id);
    CREATE INDEX IF NOT EXISTS idx_label_registry_user ON label_registry(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
  `)
}

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeDb() {
  if (_db) {
    _db.close()
    _db = null
  }
}
