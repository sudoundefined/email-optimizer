import { getDb } from '../db/db.js'

export const WeeklyDigestRepository = {
  /**
   * Save or update a weekly digest summary report for a user workspace.
   */
  async upsert(userId, weekStart, summary = {}, sql = getDb()) {
    const summaryJson = typeof summary === 'string' ? summary : JSON.stringify(summary)
    
    const [row] = await sql`
      INSERT INTO weekly_digest (
        user_id,
        week_start,
        summary,
        generated_at
      ) VALUES (
        ${userId},
        ${weekStart},
        ${summaryJson}::jsonb,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, week_start) DO UPDATE SET
        summary = EXCLUDED.summary,
        generated_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    return row
  },

  /**
   * Get a weekly digest by user and week start date (`YYYY-MM-DD`).
   */
  async getByWeek(userId, weekStart, sql = getDb()) {
    const [row] = await sql`
      SELECT *
      FROM weekly_digest
      WHERE user_id = ${userId} AND week_start = ${weekStart}
      LIMIT 1
    `
    return row || null
  },

  /**
   * List recent weekly digests for a user.
   */
  async listRecent(userId, limit = 10, sql = getDb()) {
    return sql`
      SELECT *
      FROM weekly_digest
      WHERE user_id = ${userId}
      ORDER BY week_start DESC
      LIMIT ${limit}
    `
  },

  /**
   * Clear all weekly digests for a user.
   */
  async clearAccount(userId, sql = getDb()) {
    await sql`DELETE FROM weekly_digest WHERE user_id = ${userId}`
  },

  async clearUser(userId, sql = getDb()) {
    return this.clearAccount(userId, sql)
  }
}
