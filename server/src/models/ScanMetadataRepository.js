import { getDb } from '../db/db.js'

export const ScanMetadataRepository = {
  /**
   * Record a scan run (`success`, `failed`, or `cancelled`) and enforce the 100-run retention ceiling.
   */
  async record(userId, {
    startedAt = new Date(),
    completedAt = new Date(),
    emailsScanned = 0,
    sendersFound = 0,
    durationMs = 0,
    status = 'success',
    errorMessage = null
  } = {}, sql = getDb()) {
    const [row] = await sql`
      INSERT INTO scan_metadata (
        user_id,
        started_at,
        completed_at,
        emails_scanned,
        senders_found,
        duration_ms,
        status,
        error_message
      ) VALUES (
        ${userId},
        ${startedAt},
        ${completedAt},
        ${Number(emailsScanned)},
        ${Number(sendersFound)},
        ${Number(durationMs)},
        ${status},
        ${errorMessage}
      )
      RETURNING *
    `

    // Enforce 100-run retention cap per user workspace to keep PostgreSQL storage lean
    await sql`
      DELETE FROM scan_metadata
      WHERE user_id = ${userId}
        AND scan_id NOT IN (
          SELECT scan_id
          FROM scan_metadata
          WHERE user_id = ${userId}
          ORDER BY started_at DESC
          LIMIT 100
        )
    `

    return row
  },

  /**
   * Get the most recent scan run metadata for a user.
   */
  async getLatest(userId, sql = getDb()) {
    const [row] = await sql`
      SELECT *
      FROM scan_metadata
      WHERE user_id = ${userId}
      ORDER BY started_at DESC
      LIMIT 1
    `
    return row || null
  },

  /**
   * List recent scan runs for a user.
   */
  async listRecent(userId, limit = 20, sql = getDb()) {
    return sql`
      SELECT *
      FROM scan_metadata
      WHERE user_id = ${userId}
      ORDER BY started_at DESC
      LIMIT ${limit}
    `
  },

  /**
   * Clear all scan run history for a user.
   */
  async clearAccount(userId, sql = getDb()) {
    await sql`DELETE FROM scan_metadata WHERE user_id = ${userId}`
  },

  async clearUser(userId, sql = getDb()) {
    return this.clearAccount(userId, sql)
  }
}
