import { getDb } from '../db/db.js'
import { encryptTokens, decryptTokens } from '../db/crypto.js'

export const TokenRepository = {
  /**
   * Find and decrypt tokens for a user.
   */
  async findByUserId(userId, sql = getDb()) {
    const [row] = await sql`
      SELECT encrypted, iv, updated_at
      FROM tokens
      WHERE user_id = ${userId}
      LIMIT 1
    `
    if (!row) return null
    return decryptTokens(row)
  },

  async findByAccountId(userId, sql = getDb()) {
    return this.findByUserId(userId, sql)
  },

  /**
   * Find raw encrypted token row (for internal checks/tests).
   */
  async findRawByUserId(userId, sql = getDb()) {
    const [row] = await sql`
      SELECT encrypted, iv, updated_at
      FROM tokens
      WHERE user_id = ${userId}
      LIMIT 1
    `
    return row || null
  },

  async findRawByAccountId(userId, sql = getDb()) {
    return this.findRawByUserId(userId, sql)
  },

  /**
   * Encrypt and upsert OAuth tokens for a user.
   */
  async upsert(userId, tokens, sql = getDb()) {
    const { encrypted, iv } = encryptTokens(tokens)
    await sql`
      INSERT INTO tokens (user_id, encrypted, iv, updated_at)
      VALUES (${userId}, ${encrypted}, ${iv}, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        encrypted = EXCLUDED.encrypted,
        iv = EXCLUDED.iv,
        updated_at = CURRENT_TIMESTAMP
    `
  },

  /**
   * Delete tokens for a user (on logout or auth error).
   */
  async deleteByUserId(userId, sql = getDb()) {
    await sql`DELETE FROM tokens WHERE user_id = ${userId}`
  },

  async deleteByAccountId(userId, sql = getDb()) {
    return this.deleteByUserId(userId, sql)
  }
}
