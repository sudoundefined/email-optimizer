import { getDb } from '../db/db.js'
import { LIST_LIMITS } from '../utils/constants.js'
import { config } from '../config.js'

export const UserRepository = {
  /**
   * Find user profile by ID (Google sub ID).
   */
  async findById(id, sql = getDb()) {
    try {
      const [user] = await sql`
        SELECT id, email, display_name, avatar_url, created_at, last_login_at
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `
      if (user) return user
    } catch (err) {
      // Fall through if DB query fails when checking demo user
    }

    if (config.demoMode || String(id).startsWith('acc_demo_')) {
      const { DEMO_ACCOUNTS } = await import('../gmail/mockDataset.js')
      const found = DEMO_ACCOUNTS.find(a => a.id === id) || DEMO_ACCOUNTS[0]
      return {
        id: found.id,
        email: found.email,
        display_name: found.display_name,
        avatar_url: found.avatar_url,
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      }
    }
    return null
  },

  /**
   * Find all users.
   */
  async findAll(sql = getDb()) {
    try {
      return await sql`
        SELECT id, email, display_name, avatar_url, created_at, last_login_at
        FROM users
        ORDER BY created_at ASC
        LIMIT ${LIST_LIMITS.ACCOUNTS}
      `
    } catch (err) {
      if (config.demoMode) {
        const { DEMO_ACCOUNTS } = await import('../gmail/mockDataset.js')
        return DEMO_ACCOUNTS.map(a => ({
          id: a.id,
          email: a.email,
          display_name: a.display_name,
          avatar_url: a.avatar_url,
          created_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        }))
      }
      throw err
    }
  },

  /**
   * Upsert a Google account user on login.
   */
  async upsert({ id, email, displayName, avatarUrl }, sql = getDb()) {
    const [user] = await sql`
      INSERT INTO users (id, email, display_name, avatar_url, last_login_at)
      VALUES (${id}, ${email}, ${displayName || null}, ${avatarUrl || null}, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        last_login_at = CURRENT_TIMESTAMP
      RETURNING id, email, display_name, avatar_url, created_at, last_login_at
    `
    return user
  },

  /**
   * Delete user by ID (cascades to tokens, label_registry, logs, preferences, etc.).
   */
  async deleteById(id, sql = getDb()) {
    await sql`DELETE FROM users WHERE id = ${id}`
  }
}
