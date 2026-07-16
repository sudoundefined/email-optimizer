import { getDb } from '../db/db.js'
import { LIST_LIMITS } from '../utils/constants.js'

function getRowDetails(row) {
  if (!row || !row.details) return {}
  if (typeof row.details === 'object') return row.details
  if (typeof row.details === 'string') {
    try {
      return JSON.parse(row.details)
    } catch {
      return {}
    }
  }
  return {}
}

export const ActivityLogRepository = {
  /**
   * Log an activity entry for a user workspace.
   */
  async insert(userId, action, details = {}, sql = getDb()) {
    const safeDetails = details || {}
    const detailsStr = typeof safeDetails === 'string' ? safeDetails : JSON.stringify(safeDetails)
    await sql`
      INSERT INTO activity_log (user_id, action, details)
      VALUES (${userId}, ${action}, ${detailsStr})
    `
  },

  /**
   * Get recent activity for a user.
   */
  async findRecent(userId, limit = LIST_LIMITS.MESSAGES_DEFAULT, sql = getDb()) {
    return sql`
      SELECT id, action, details, created_at
      FROM activity_log
      WHERE user_id = ${userId}
      ORDER BY id DESC
      LIMIT ${limit}
    `
  },

  /**
   * Get paginated activity items and total count for a user.
   */
  async findPaginated(userId, { page = 1, limit = LIST_LIMITS.AUDIT_PAGE_DEFAULT, action } = {}, sql = getDb()) {
    const offset = (page - 1) * limit
    const totalQuery = action
      ? sql`SELECT COUNT(*) as count FROM activity_log WHERE user_id = ${userId} AND action = ${action}`
      : sql`SELECT COUNT(*) as count FROM activity_log WHERE user_id = ${userId}`
    const itemsQuery = action
      ? sql`SELECT id, action, details, created_at FROM activity_log WHERE user_id = ${userId} AND action = ${action} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
      : sql`SELECT id, action, details, created_at FROM activity_log WHERE user_id = ${userId} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`

    const [countRows, rawItems] = await Promise.all([totalQuery, itemsQuery])
    const total = Number(countRows[0]?.count || 0)
    return { rawItems, total, page, pages: Math.ceil(total / (limit || 1)) }
  },

  /**
   * Aggregate gamification statistics (emails cleaned/trashed/unsubscribed/labeled).
   */
  async getGamificationStats(userId, sql = getDb()) {
    const fetchLimit = Math.min(5000, LIST_LIMITS.ACTIVITY_LOGS)
    const rows = await sql`
      SELECT action, details
      FROM activity_log
      WHERE user_id = ${userId} AND details IS NOT NULL
      ORDER BY id DESC
      LIMIT ${fetchLimit}
    `

    let emailsCleaned = 0
    let unsubscribedCount = 0
    let labeledCount = 0
    let trashedSendersCount = 0

    for (const row of rows) {
      const details = getRowDetails(row)
      if (row.action === 'trash_messages') {
        emailsCleaned += (details.count || 0)
      } else if (row.action === 'trash_senders') {
        trashedSendersCount += (details.count || 1)
        emailsCleaned += (details.trashedMessages || details.count * 5 || 0)
      } else if (row.action === 'unsubscribe') {
        unsubscribedCount += (details.count || 1)
        emailsCleaned += (details.trashedMessages || details.count * 5 || 0)
      } else if (row.action === 'apply_labels') {
        labeledCount += (details.count || 1)
      } else if (row.action === 'keep_latest') {
        emailsCleaned += (details.trashed || 0)
      }
    }

    // Estimate time saved: 15s per email cleaned, 2m per unsub
    const secondsSaved = (emailsCleaned * 15) + (unsubscribedCount * 120)
    const hoursSaved = parseFloat((secondsSaved / 3600).toFixed(1))

    // Estimate CO2 saved: 0.3g per stored email
    const co2SavedGrams = Math.round(emailsCleaned * 0.3)

    return {
      emailsCleaned,
      unsubscribedCount,
      labeledCount,
      trashedSendersCount,
      hoursSaved,
      co2SavedGrams,
      totalActions: rows.length,
    }
  }
}
