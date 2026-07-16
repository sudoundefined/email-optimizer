import { getDb } from '../db/db.js'

export const CleanupHistoryRepository = {
  /**
   * Record a completed cleanup session.
   */
  async record(userId, { emailsRemoved = 0, storageSavedMb = 0, timeSavedSeconds = 0, durationSeconds = 0 } = {}, sql = getDb()) {
    const [row] = await sql`
      INSERT INTO cleanup_history (
        user_id,
        emails_removed,
        storage_saved_mb,
        time_saved_seconds,
        duration_seconds,
        created_at
      ) VALUES (
        ${userId},
        ${Number(emailsRemoved)},
        ${Number(storageSavedMb)},
        ${Number(timeSavedSeconds)},
        ${Number(durationSeconds)},
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `
    return row
  },

  /**
   * List recent cleanup sessions for a user.
   */
  async listRecent(userId, limit = 20, sql = getDb()) {
    return sql`
      SELECT *
      FROM cleanup_history
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  },

  /**
   * Get aggregate lifetime cleanup statistics for a user.
   */
  async getSummaryStats(userId, sql = getDb()) {
    const [stats] = await sql`
      SELECT 
        COALESCE(SUM(emails_removed), 0)::int as total_emails_removed,
        COALESCE(SUM(storage_saved_mb), 0)::numeric(10, 2) as total_storage_saved_mb,
        COALESCE(SUM(time_saved_seconds), 0)::int as total_time_saved_seconds,
        COUNT(*)::int as total_sessions
      FROM cleanup_history
      WHERE user_id = ${userId}
    `
    return stats || { total_emails_removed: 0, total_storage_saved_mb: 0, total_time_saved_seconds: 0, total_sessions: 0 }
  },

  /**
   * Clear all cleanup history for a user.
   */
  async clearAccount(userId, sql = getDb()) {
    await sql`DELETE FROM cleanup_history WHERE user_id = ${userId}`
  },

  async clearUser(userId, sql = getDb()) {
    return this.clearAccount(userId, sql)
  }
}
