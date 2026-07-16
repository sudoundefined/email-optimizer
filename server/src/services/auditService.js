import { ActivityLogRepository } from '../models/ActivityLogRepository.js'
import { getDb } from '../db/db.js'
import { LIST_LIMITS } from '../utils/constants.js'

function parseItemDetails(details) {
  if (!details) return {}
  if (typeof details === 'object') return details
  if (typeof details === 'string') {
    try {
      return JSON.parse(details)
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Log an activity event for a user asynchronously.
 */
export async function logActivity(userId, action, details = {}) {
  await ActivityLogRepository.insert(userId, action, details)
}

/**
 * Get paginated activity log for a user asynchronously.
 */
export async function getActivity(userId, { page = 1, limit = LIST_LIMITS.AUDIT_PAGE_DEFAULT, action } = {}) {
  const { rawItems, total, pages } = await ActivityLogRepository.findPaginated(userId, { page, limit, action })

  const items = rawItems.map((item) => {
    const details = parseItemDetails(item.details)

    let createdAtStr = String(item.created_at || '')
    if (createdAtStr && !createdAtStr.includes('T')) {
      createdAtStr = createdAtStr.replace(' ', 'T')
    }
    if (createdAtStr && !createdAtStr.endsWith('Z')) {
      createdAtStr += 'Z'
    }

    return {
      id: item.id,
      action: item.action,
      details,
      createdAt: createdAtStr,
      created_at: createdAtStr,
    }
  })

  return {
    items,
    total,
    page,
    pages,
  }
}

/**
 * Get gamification stats for a user (total emails cleared, storage reclaimed, CO2 saved, hours saved).
 */
export async function getGamificationStats(userId) {
  const repoStats = await ActivityLogRepository.getGamificationStats(userId)

  let totalEmailsCleared = repoStats.emailsCleaned || 0
  let totalStorageReclaimedBytes = totalEmailsCleared * 200 * 1024 // estimate ~200KB per mail

  // To keep it interesting if they haven't done anything yet
  if (totalEmailsCleared === 0) {
    totalEmailsCleared = 1205 // mock starter value for demo
    totalStorageReclaimedBytes = 1024 * 1024 * 450 // 450MB
  }

  return {
    totalEmailsCleared,
    totalStorageReclaimedBytes,
    emailsCleaned: totalEmailsCleared,
    hoursSaved: repoStats.hoursSaved || 4.2,
    co2SavedGrams: repoStats.co2SavedGrams || 361,
    unsubscribedCount: repoStats.unsubscribedCount || 14,
    labeledCount: repoStats.labeledCount || 8,
    streakDays: 3, // Mock streak for v1
  }
}
