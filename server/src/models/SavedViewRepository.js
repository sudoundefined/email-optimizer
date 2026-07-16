import { getDb } from '../db/db.js'

export const SavedViewRepository = {
  /**
   * List all custom saved views for a user workspace.
   */
  async listByUserId(userId, sql = getDb()) {
    return sql`
      SELECT *
      FROM saved_views
      WHERE user_id = ${userId}
      ORDER BY name ASC
    `
  },

  async listByAccountId(userId, sql = getDb()) {
    return this.listByUserId(userId, sql)
  },

  /**
   * Create or update a custom saved view.
   */
  async createOrUpdate(userId, name, filterJson = {}, sortJson = {}, sql = getDb()) {
    const filterPayload = typeof filterJson === 'string' ? filterJson : JSON.stringify(filterJson)
    const sortPayload = typeof sortJson === 'string' ? sortJson : JSON.stringify(sortJson)

    const [row] = await sql`
      INSERT INTO saved_views (
        user_id,
        name,
        filter_json,
        sort_json,
        created_at
      ) VALUES (
        ${userId},
        ${name},
        ${filterPayload}::jsonb,
        ${sortPayload}::jsonb,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, name) DO UPDATE SET
        filter_json = EXCLUDED.filter_json,
        sort_json = EXCLUDED.sort_json
      RETURNING *
    `
    return row
  },

  /**
   * Delete a saved view by its ID.
   */
  async deleteById(userId, viewId, sql = getDb()) {
    await sql`
      DELETE FROM saved_views
      WHERE user_id = ${userId} AND id = ${viewId}
    `
  },

  /**
   * Delete a saved view by name.
   */
  async deleteByName(userId, name, sql = getDb()) {
    await sql`
      DELETE FROM saved_views
      WHERE user_id = ${userId} AND name = ${name}
    `
  },

  /**
   * Clear all saved views for a user.
   */
  async clearAccount(userId, sql = getDb()) {
    await sql`DELETE FROM saved_views WHERE user_id = ${userId}`
  },

  async clearUser(userId, sql = getDb()) {
    return this.clearAccount(userId, sql)
  }
}
