import { getDb } from '../db/db.js'

/**
 * Persistent state for the scheduled weekly digest, per user.
 * Now backed by SQLite (preferences + digest_baseline tables).
 */

const HISTORY_MAX = 20

// In-memory history cache per user (audit log can supplement this)
const historyCache = new Map()

export const DEFAULT_SETTINGS = {
  enabled: false,
  dayOfWeek: 1, // Monday
  hour: 9,
  recipient: '', // '' means "the connected account's own address"
}

export function getSettings(userId) {
  const db = getDb()
  const row = db.prepare(`
    SELECT digest_enabled as enabled, digest_day as dayOfWeek, digest_hour as hour, digest_recipient as recipient
    FROM preferences WHERE user_id = ?
  `).get(userId)

  if (!row) return { ...DEFAULT_SETTINGS }

  return {
    enabled: Boolean(row.enabled),
    dayOfWeek: row.dayOfWeek ?? DEFAULT_SETTINGS.dayOfWeek,
    hour: row.hour ?? DEFAULT_SETTINGS.hour,
    recipient: row.recipient || '',
  }
}

export function getState(userId) {
  const settings = getSettings(userId)
  const baseline = getBaseline(userId)
  const lastRunAt = getLastRunAt(userId)
  const history = getHistory(userId)
  return { settings, baseline, lastRunAt, history }
}

function getBaseline(userId) {
  const db = getDb()
  const row = db.prepare('SELECT senders FROM digest_baseline WHERE user_id = ?').get(userId)
  if (!row || !row.senders) return { knownSenders: [] }
  try {
    return { knownSenders: JSON.parse(row.senders) }
  } catch {
    return { knownSenders: [] }
  }
}

function getLastRunAt(userId) {
  const db = getDb()
  const row = db.prepare('SELECT last_run_at FROM digest_baseline WHERE user_id = ?').get(userId)
  return row?.last_run_at || null
}

function getHistory(userId) {
  return historyCache.get(userId) || []
}

/** Validate + normalize a partial settings patch. Throws on bad input. */
export function normalizeSettings(patch) {
  const s = { ...DEFAULT_SETTINGS, ...(patch || {}) }
  const enabled = Boolean(s.enabled)
  const dayOfWeek = Number(s.dayOfWeek)
  const hour = Number(s.hour)
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    const err = new Error('dayOfWeek must be an integer 0-6 (Sunday=0)')
    err.status = 400
    throw err
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    const err = new Error('hour must be an integer 0-23')
    err.status = 400
    throw err
  }
  const recipient = typeof s.recipient === 'string' ? s.recipient.trim() : ''
  if (recipient && !/^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+$/.test(recipient)) {
    const err = new Error('recipient must be a valid email address or blank')
    err.status = 400
    throw err
  }
  return { enabled, dayOfWeek, hour, recipient }
}

export function saveSettings(userId, patch) {
  const current = getSettings(userId)
  const merged = normalizeSettings({ ...current, ...patch })

  const db = getDb()
  db.prepare(`
    UPDATE preferences SET
      digest_enabled = ?, digest_day = ?, digest_hour = ?, digest_recipient = ?
    WHERE user_id = ?
  `).run(merged.enabled ? 1 : 0, merged.dayOfWeek, merged.hour, merged.recipient, userId)

  return merged
}

export function getKnownSenders(userId) {
  return getBaseline(userId).knownSenders
}

/**
 * Record a completed digest run: merge the reported senders into the baseline,
 * stamp lastRunAt, and prepend a history entry.
 */
export function recordRun(userId, { at, reportedEmails = [], sent, recipient, error = null }) {
  const db = getDb()

  // Update baseline
  const current = getBaseline(userId)
  const known = new Set(current.knownSenders.map((e) => e.toLowerCase()))
  for (const e of reportedEmails) known.add(String(e).toLowerCase())
  const senders = JSON.stringify([...known])

  db.prepare(`
    INSERT INTO digest_baseline (user_id, senders, last_run_at, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      senders = excluded.senders,
      last_run_at = excluded.last_run_at,
      updated_at = datetime('now')
  `).run(userId, senders, at)

  // Update in-memory history
  const history = getHistory(userId)
  const updated = [
    { at, newSenders: reportedEmails.length, sent: Boolean(sent), recipient: recipient || null, error },
    ...history,
  ].slice(0, HISTORY_MAX)
  historyCache.set(userId, updated)

  return getState(userId)
}
