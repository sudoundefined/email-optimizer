import { getDb } from '../db/db.js'
import { LIST_LIMITS } from '../utils/constants.js'

export const LabelRegistryRepository = {
  /**
   * Get all registered app labels for a user.
   */
  async findByUserId(userId, sql = getDb()) {
    return sql`
      SELECT id, label_name, gmail_id, created_at
      FROM label_registry
      WHERE user_id = ${userId}
      ORDER BY label_name ASC
      LIMIT ${LIST_LIMITS.LABELS}
    `
  },

  async findByAccountId(userId, sql = getDb()) {
    return this.findByUserId(userId, sql)
  },

  /**
   * Find label mapping by label name.
   */
  async findByName(userId, labelName, sql = getDb()) {
    const [row] = await sql`
      SELECT id, label_name, gmail_id, created_at
      FROM label_registry
      WHERE user_id = ${userId} AND label_name = ${labelName}
      LIMIT 1
    `
    return row || null
  },

  /**
   * Register a new label name -> gmail ID mapping.
   */
  async insert(userId, labelName, gmailId, sql = getDb()) {
    await sql`
      INSERT INTO label_registry (user_id, label_name, gmail_id)
      VALUES (${userId}, ${labelName}, ${gmailId})
      ON CONFLICT(user_id, label_name) DO UPDATE SET gmail_id = EXCLUDED.gmail_id
    `
  },

  /**
   * Remove label from registry by name.
   */
  async deleteByName(userId, labelName, sql = getDb()) {
    await sql`
      DELETE FROM label_registry
      WHERE user_id = ${userId} AND label_name = ${labelName}
    `
  },

  /**
   * Remove label from registry by Gmail ID.
   */
  async deleteByGmailId(userId, gmailId, sql = getDb()) {
    await sql`
      DELETE FROM label_registry
      WHERE user_id = ${userId} AND gmail_id = ${gmailId}
    `
  }
}
