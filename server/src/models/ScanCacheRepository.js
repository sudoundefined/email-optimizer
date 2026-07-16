import { getDb } from '../db/db.js'

export const ScanCacheRepository = {
  /**
   * Get the cached dashboard summary for a user workspace.
   */
  async getByUserId(userId, sql = getDb()) {
    const [row] = await sql`
      SELECT 
        user_id,
        last_scan,
        total_messages,
        total_senders,
        unread_messages,
        storage_used_mb,
        recoverable_storage_mb,
        health_score,
        cleanup_score,
        organization_score,
        security_score,
        newsletter_count,
        large_attachment_count,
        mailbox_dna,
        dashboard_json,
        updated_at
      FROM scan_cache
      WHERE user_id = ${userId}
      LIMIT 1
    `
    return row || null
  },

  /**
   * Alias during transition.
   */
  async getByAccountId(userId, sql = getDb()) {
    return this.getByUserId(userId, sql)
  },

  /**
   * Atomic UPSERT of the scan summary cache.
   */
  async upsert(userId, data, sql = getDb()) {
    const totalMessages = Number(data.totalMessages || data.total_messages || 0)
    const totalSenders = Number(data.totalSenders || data.total_senders || 0)
    const unreadMessages = Number(data.unreadMessages || data.unread_messages || 0)
    const storageUsedMb = Number(data.storageUsedMb || data.storage_used_mb || 0)
    const recoverableStorageMb = Number(data.recoverableStorageMb || data.recoverable_storage_mb || 0)
    const healthScore = Number(data.healthScore || data.health_score || 100)
    const cleanupScore = Number(data.cleanupScore || data.cleanup_score || 100)
    const organizationScore = Number(data.organizationScore || data.organization_score || 100)
    const securityScore = Number(data.securityScore || data.security_score || 100)
    const newsletterCount = Number(data.newsletterCount || data.newsletter_count || 0)
    const largeAttachmentCount = Number(data.largeAttachmentCount || data.large_attachment_count || 0)
    const mailboxDna = JSON.stringify(data.mailboxDna || data.mailbox_dna || {})
    const dashboardJson = JSON.stringify(data.dashboardJson || data.dashboard_json || {})

    const [row] = await sql`
      INSERT INTO scan_cache (
        user_id,
        last_scan,
        total_messages,
        total_senders,
        unread_messages,
        storage_used_mb,
        recoverable_storage_mb,
        health_score,
        cleanup_score,
        organization_score,
        security_score,
        newsletter_count,
        large_attachment_count,
        mailbox_dna,
        dashboard_json,
        updated_at
      ) VALUES (
        ${userId},
        CURRENT_TIMESTAMP,
        ${totalMessages},
        ${totalSenders},
        ${unreadMessages},
        ${storageUsedMb},
        ${recoverableStorageMb},
        ${healthScore},
        ${cleanupScore},
        ${organizationScore},
        ${securityScore},
        ${newsletterCount},
        ${largeAttachmentCount},
        ${mailboxDna}::jsonb,
        ${dashboardJson}::jsonb,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) DO UPDATE SET
        last_scan = CURRENT_TIMESTAMP,
        total_messages = EXCLUDED.total_messages,
        total_senders = EXCLUDED.total_senders,
        unread_messages = EXCLUDED.unread_messages,
        storage_used_mb = EXCLUDED.storage_used_mb,
        recoverable_storage_mb = EXCLUDED.recoverable_storage_mb,
        health_score = EXCLUDED.health_score,
        cleanup_score = EXCLUDED.cleanup_score,
        organization_score = EXCLUDED.organization_score,
        security_score = EXCLUDED.security_score,
        newsletter_count = EXCLUDED.newsletter_count,
        large_attachment_count = EXCLUDED.large_attachment_count,
        mailbox_dna = EXCLUDED.mailbox_dna,
        dashboard_json = EXCLUDED.dashboard_json,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    return row
  },

  /**
   * Delete cached scan summary for a user.
   */
  async deleteByUserId(userId, sql = getDb()) {
    await sql`DELETE FROM scan_cache WHERE user_id = ${userId}`
  },

  async deleteByAccountId(userId, sql = getDb()) {
    return this.deleteByUserId(userId, sql)
  }
}
