import { getDb } from '../db/db.js'
import { LIST_LIMITS } from '../utils/constants.js'

export const ProtectedSenderRepository = {
  /**
   * Find all protected senders scoped to a specific user workspace.
   */
  async list(userId, sql = getDb()) {
    if (typeof userId === 'function' || typeof userId === 'object' || !userId) {
      if (typeof userId === 'function') sql = userId
      return []
    }
    return sql`
      SELECT id, email, domain, source, added_at
      FROM protected_senders
      WHERE user_id = ${String(userId)}
      ORDER BY email ASC
      LIMIT ${LIST_LIMITS.SENDERS_DEFAULT}
    `
  },

  /**
   * Alias for list(userId, sql).
   */
  async findByUserId(userId, sql = getDb()) {
    return this.list(userId, sql)
  },

  /**
   * Check if a specific sender email is protected for the user.
   */
  async isProtected(userId, email, sql = getDb()) {
    if (typeof userId !== 'string' && typeof arguments[1] === 'function') {
      // Legacy call without userId
      email = arguments[0]
      sql = arguments[1] || getDb()
      userId = null
    }
    if (!userId || !email) return false

    const normalized = String(email).toLowerCase().trim()
    const [row] = await sql`
      SELECT 1 FROM protected_senders
      WHERE user_id = ${String(userId)} AND email = ${normalized}
      LIMIT 1
    `
    return !!row
  },

  /**
   * Insert protected senders for a specific user in batch (ignores duplicates).
   */
  async insertMany(userId, emails, source = 'manual', sql = getDb()) {
    if (typeof userId !== 'string' && Array.isArray(arguments[0])) {
      emails = arguments[0]
      source = arguments[1] || 'manual'
      sql = arguments[2] || getDb()
      userId = null
    }
    if (!userId || !emails || emails.length === 0) return

    for (const email of emails) {
      const normalized = String(email).toLowerCase().trim()
      const domain = normalized.split('@')[1] || ''
      await sql`
        INSERT INTO protected_senders (user_id, email, domain, source)
        VALUES (${String(userId)}, ${normalized}, ${domain}, ${source})
        ON CONFLICT(user_id, email) DO NOTHING
      `
    }
  },

  /**
   * Remove protected senders by email for a specific user.
   */
  async deleteMany(userId, emails, sql = getDb()) {
    if (typeof userId !== 'string' && Array.isArray(arguments[0])) {
      emails = arguments[0]
      sql = arguments[1] || getDb()
      userId = null
    }
    if (!userId || !emails || emails.length === 0) return

    const normalizedList = emails.map(e => String(e).toLowerCase().trim())
    await sql`
      DELETE FROM protected_senders
      WHERE user_id = ${String(userId)} AND email = ANY(${normalizedList})
    `
  }
}
