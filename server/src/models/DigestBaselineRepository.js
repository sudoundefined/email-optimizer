import { getDb } from '../db/db.js'

export const DigestBaselineRepository = {
  /**
   * Find digest baseline for a user.
   */
  async findByUserId(userId, sql = getDb()) {
    const [row] = await sql`
      SELECT senders, last_run_at, updated_at
      FROM digest_baseline
      WHERE user_id = ${userId}
      LIMIT 1
    `
    return row || null
  },

  async findByAccountId(userId, sql = getDb()) {
    return this.findByUserId(userId, sql)
  },

  /**
   * Upsert digest baseline.
   */
  async upsert(userId, senders, lastRunAt = null, sql = getDb()) {
    const sendersStr = typeof senders === 'string' ? senders : JSON.stringify(senders || [])
    await sql`
      INSERT INTO digest_baseline (user_id, senders, last_run_at, updated_at)
      VALUES (${userId}, ${sendersStr}, ${lastRunAt}, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        senders = EXCLUDED.senders,
        last_run_at = COALESCE(EXCLUDED.last_run_at, digest_baseline.last_run_at),
        updated_at = CURRENT_TIMESTAMP
    `
  }
}
