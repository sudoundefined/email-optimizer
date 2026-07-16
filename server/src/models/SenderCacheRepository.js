import { getDb } from '../db/db.js'

export const SenderCacheRepository = {
  /**
   * Find a specific cached sender by email.
   */
  async findByEmail(userId, senderEmail, sql = getDb()) {
    const [sender] = await sql`
      SELECT *
      FROM sender_cache
      WHERE user_id = ${userId} AND sender_email = ${senderEmail}
      LIMIT 1
    `
    return sender || null
  },

  /**
   * List cached senders for a user with SARGable filtering and sorting.
   */
  async listByUserId(userId, { category = null, limit = 500, unreadOnly = false, minStorageMb = 0 } = {}, sql = getDb()) {
    if (category && category !== 'All') {
      return sql`
        SELECT *
        FROM sender_cache
        WHERE user_id = ${userId}
          AND category = ${category}
          ${unreadOnly ? sql`AND unread_messages > 0` : sql``}
          ${minStorageMb > 0 ? sql`AND storage_mb >= ${minStorageMb}` : sql``}
        ORDER BY last_received DESC NULLS LAST
        LIMIT ${limit}
      `
    }

    return sql`
      SELECT *
      FROM sender_cache
      WHERE user_id = ${userId}
        ${unreadOnly ? sql`AND unread_messages > 0` : sql``}
        ${minStorageMb > 0 ? sql`AND storage_mb >= ${minStorageMb}` : sql``}
      ORDER BY last_received DESC NULLS LAST
      LIMIT ${limit}
    `
  },

  /**
   * Legacy alias during transition.
   */
  async listByAccountId(userId, options, sql = getDb()) {
    return this.listByUserId(userId, options, sql)
  },

  /**
   * Batch UPSERT sender records after a scan.
   */
  async upsertBatch(userId, sendersArray, scanTimestamp = new Date(), sql = getDb()) {
    if (!Array.isArray(sendersArray) || sendersArray.length === 0) return []

    // Process in chunks of 100 to avoid exceeding parameter limits
    const chunkSize = 100
    const results = []

    for (let i = 0; i < sendersArray.length; i += chunkSize) {
      const chunk = sendersArray.slice(i, i + chunkSize)
      
      for (const s of chunk) {
        const email = s.senderEmail || s.email || s.sender_email
        if (!email) continue

        const [row] = await sql`
          INSERT INTO sender_cache (
            user_id,
            sender_email,
            sender_name,
            domain,
            category,
            total_messages,
            unread_messages,
            storage_mb,
            first_received,
            last_received,
            open_rate,
            health_score,
            recommendation,
            verified,
            protected,
            updated_at
          ) VALUES (
            ${userId},
            ${email.toLowerCase()},
            ${s.senderName || s.name || s.sender_name || null},
            ${s.domain || email.split('@')[1] || null},
            ${s.category || 'Other'},
            ${Number(s.totalMessages || s.total_messages || s.count || 0)},
            ${Number(s.unreadMessages || s.unread_messages || s.unreadCount || 0)},
            ${Number(s.storageMb || s.storage_mb || s.storageEst || 0)},
            ${s.firstReceived || s.first_received || null},
            ${s.lastReceived || s.last_received || null},
            ${Number(s.openRate || s.open_rate || 0)},
            ${Number(s.healthScore || s.health_score || 100)},
            ${s.recommendation || 'Review'},
            ${Boolean(s.verified)},
            ${Boolean(s.protected || s.isProtected)},
            ${scanTimestamp}
          )
          ON CONFLICT (user_id, sender_email) DO UPDATE SET
            sender_name = COALESCE(EXCLUDED.sender_name, sender_cache.sender_name),
            domain = COALESCE(EXCLUDED.domain, sender_cache.domain),
            category = EXCLUDED.category,
            total_messages = EXCLUDED.total_messages,
            unread_messages = EXCLUDED.unread_messages,
            storage_mb = EXCLUDED.storage_mb,
            first_received = COALESCE(EXCLUDED.first_received, sender_cache.first_received),
            last_received = EXCLUDED.last_received,
            open_rate = EXCLUDED.open_rate,
            health_score = EXCLUDED.health_score,
            recommendation = EXCLUDED.recommendation,
            verified = EXCLUDED.verified,
            protected = EXCLUDED.protected,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        `
        if (row) results.push(row)
      }
    }

    return results
  },

  /**
   * Prune stale senders that were not updated in the current scan timestamp.
   */
  async pruneStale(userId, scanTimestamp, sql = getDb()) {
    await sql`
      DELETE FROM sender_cache
      WHERE user_id = ${userId} AND updated_at < ${scanTimestamp}
    `
  },

  /**
   * Delete specific sender row by email.
   */
  async deleteByEmail(userId, senderEmail, sql = getDb()) {
    await sql`
      DELETE FROM sender_cache
      WHERE user_id = ${userId} AND sender_email = ${senderEmail}
    `
  },

  /**
   * Clear all cached senders for a user.
   */
  async clearAccount(userId, sql = getDb()) {
    await sql`DELETE FROM sender_cache WHERE user_id = ${userId}`
  },

  async clearUser(userId, sql = getDb()) {
    return this.clearAccount(userId, sql)
  }
}
