import { getDb } from '../db/db.js'

/** Registry of Gmail label ids created by this app, per user. */

export function listRegistered(userId) {
  const db = getDb()
  return db.prepare(
    'SELECT gmail_id as id, label_name as name, created_at as createdAt FROM label_registry WHERE user_id = ? ORDER BY created_at'
  ).all(userId)
}

export function registerLabel(userId, { id, name }) {
  const db = getDb()
  db.prepare(`
    INSERT OR IGNORE INTO label_registry (user_id, label_name, gmail_id)
    VALUES (?, ?, ?)
  `).run(userId, name, id)
}

export function unregisterLabel(userId, id) {
  const db = getDb()
  db.prepare('DELETE FROM label_registry WHERE user_id = ? AND gmail_id = ?').run(userId, id)
}
