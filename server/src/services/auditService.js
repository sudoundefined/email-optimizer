import { getDb } from '../db/db.js'

/**
 * Log an activity event for a user.
 * @param {string} userId
 * @param {string} action - 'login' | 'logout' | 'scan' | 'keep_latest'
 * @param {object} [details] - Action-specific data (stored as JSON)
 */
export function logActivity(userId, action, details = {}) {
  const db = getDb()
  db.prepare(`
    INSERT INTO activity_log (user_id, action, details)
    VALUES (?, ?, ?)
  `).run(userId, action, JSON.stringify(details))
}

/**
 * Get paginated activity log for a user.
 * @param {string} userId
 * @param {{ page?: number, limit?: number, action?: string }} options
 * @returns {{ items: Array, total: number, page: number, pages: number }}
 */
export function getActivity(userId, { page = 1, limit = 20, action } = {}) {
  const db = getDb()
  const offset = (page - 1) * limit

  let where = 'WHERE user_id = ?'
  const params = [userId]

  if (action) {
    where += ' AND action = ?'
    params.push(action)
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM activity_log ${where}`).get(...params).count
  const rawItems = db.prepare(
    `SELECT id, action, details, created_at FROM activity_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset)

  // Parse JSON details & format created_at as valid ISO-8601 UTC ('Z')
  const items = rawItems.map((item) => {
    let details = {}
    try {
      details = item.details ? JSON.parse(item.details) : {}
    } catch {
      details = {}
    }

    let createdAtStr = String(item.created_at || '')
    if (createdAtStr && !createdAtStr.includes('T')) {
      createdAtStr = createdAtStr.replace(' ', 'T')
    }
    if (createdAtStr && !createdAtStr.endsWith('Z')) {
      createdAtStr += 'Z'
    }

    return {
      id: item.id,
      action: item.action,
      details,
      createdAt: createdAtStr,
      created_at: createdAtStr,
    }
  })

  return {
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}
