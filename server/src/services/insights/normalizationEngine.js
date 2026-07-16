import { getDb } from '../../db/db.js'
import { SenderCacheRepository } from '../../models/SenderCacheRepository.js'
import { ProtectedSenderRepository } from '../../models/ProtectedSenderRepository.js'
import { ActivityLogRepository } from '../../models/ActivityLogRepository.js'
import { suggestCategory } from '../categorizer.js'

/**
 * Normalization Engine: Aggregates raw sender cache rows, protected lists, and activity logs
 * into standardized, deterministic numerical inputs for the scoring and widget engines.
 */
export const normalizationEngine = {
  async normalize(userId, sql = getDb()) {
    const [senders, protectedList, activities] = await Promise.all([
      SenderCacheRepository.getByAccountId(userId, sql),
      ProtectedSenderRepository.findByUserId(userId, sql),
      ActivityLogRepository.findByUserId(userId, { limit: 200 }, sql)
    ])

    let totalEmails = 0
    let totalStorageBytes = 0
    let unreadCount = 0
    let promotionsAndMarketing = 0
    let totalSubscriptionSenders = 0
    let inactiveSubscriptionSenders = 0
    let labeledSenders = 0
    let importantSendersCount = 0
    let candidateEmails = 0
    let candidateStorageBytes = 0

    const categoryCounts = {}
    const categoryMessages = {}
    const categoryStorageBytes = {}

    const now = Date.now()
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000

    // Attachment breakdown approximations based on sender size density (>200KB avg implies heavy attachments)
    let largeAttachmentsBytes = 0
    let newslettersBytes = 0
    let largeMessagesBytes = 0

    for (const s of senders) {
      const count = Number(s.messageCount || 0)
      const size = Number(s.totalSizeEstimate || 0)
      const unread = Number(s.unreadCount || 0)
      const avgSize = count > 0 ? size / count : 0

      totalEmails += count
      totalStorageBytes += size
      unreadCount += unread

      if (s.userTags && Array.isArray(s.userTags) && s.userTags.length > 0) {
        labeledSenders++
      }

      const catInfo = suggestCategory(s)
      const cat = catInfo?.category || 'Other'
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
      categoryMessages[cat] = (categoryMessages[cat] || 0) + count
      categoryStorageBytes[cat] = (categoryStorageBytes[cat] || 0) + size

      const isSub = Boolean(s.unsubscribe && s.unsubscribe.method && s.unsubscribe.method !== 'none') || cat === 'Newsletters' || cat === 'Promotions'
      if (isSub) {
        totalSubscriptionSenders++
        const lastDate = s.lastMessageDate ? new Date(s.lastMessageDate).getTime() : 0
        if (!lastDate || (now - lastDate > sixtyDaysMs)) {
          inactiveSubscriptionSenders++
        }
      }

      if (cat === 'Promotions' || cat === 'Shopping') {
        promotionsAndMarketing += count
      }

      if (cat === 'Banking' || cat === 'Finance' || cat === 'Work' || (s.domain && s.domain.endsWith('.gov'))) {
        importantSendersCount++
      }

      if (cat === 'Promotions' || cat === 'Newsletters' || cat === 'Shopping' || isSub) {
        candidateEmails += count
        candidateStorageBytes += size
        if (cat === 'Newsletters') {
          newslettersBytes += size
        }
      }

      if (avgSize > 200 * 1024) {
        largeAttachmentsBytes += size
      } else if (avgSize > 80 * 1024) {
        largeMessagesBytes += size
      }
    }

    // Calculate cleanup streak and recent sessions from activity logs
    let recentCleanupSessionsCount = 0
    const cleanupDays = new Set()
    for (const act of activities) {
      if (!act || !act.action) continue
      const actionLower = String(act.action).toLowerCase()
      if (actionLower.includes('unsubscribe') || actionLower.includes('trash') || actionLower.includes('delete') || actionLower.includes('cleanup')) {
        recentCleanupSessionsCount++
        if (act.created_at) {
          const dayStr = new Date(act.created_at).toISOString().split('T')[0]
          cleanupDays.add(dayStr)
        }
      }
    }

    // Calculate consecutive days from today
    let cleanupStreakDays = 0
    let checkDate = new Date()
    while (true) {
      const dayStr = checkDate.toISOString().split('T')[0]
      if (cleanupDays.has(dayStr)) {
        cleanupStreakDays++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        // Allow 1 day gap if checked today and today isn't logged yet
        if (cleanupStreakDays === 0) {
          checkDate.setDate(checkDate.getDate() - 1)
          const prevDayStr = checkDate.toISOString().split('T')[0]
          if (cleanupDays.has(prevDayStr)) {
            cleanupStreakDays++
            checkDate.setDate(checkDate.getDate() - 1)
            continue
          }
        }
        break
      }
    }

    const totalStorageMB = Number((totalStorageBytes / (1024 * 1024)).toFixed(1))
    const candidateStorageMB = Number((candidateStorageBytes / (1024 * 1024)).toFixed(1))

    return {
      totalEmails,
      totalStorageBytes,
      totalStorageMB,
      unreadCount,
      senderCount: senders.length,
      protectedSendersCount: protectedList.length,
      importantSendersCount,
      promotionsAndMarketing,
      totalSubscriptionSenders,
      inactiveSubscriptionSenders,
      labeledSenders,
      candidateEmails,
      candidateStorageBytes,
      candidateStorageMB,
      largeAttachmentsBytes,
      newslettersBytes,
      largeMessagesBytes,
      categoryCounts,
      categoryMessages,
      categoryStorageBytes,
      recentCleanupSessionsCount,
      cleanupStreakDays,
      senders,
      protectedList,
      activities
    }
  }
}
