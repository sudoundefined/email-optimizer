import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'
import { requireScan } from '../store/scanCache.js'
import { onboardingService } from './onboardingService.js'
import { insightsService } from './insightsService.js'

const BATCH_MODIFY_MAX = 1000

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Job runner: move every scanned message from the given senders to
 * Trash (recoverable for 30 days — never a permanent delete), then
 * drop those senders from the scan cache so the UI reflects reality.
 */
export async function runTrashSenders(userId, { senderEmails }, emit) {
  return withAuthErrorHandling(async () => {
    const scan = requireScan(userId)
    const gmail = await getGmail(userId)

    const senders = senderEmails
      .map((e) => scan.senders.get(String(e).toLowerCase()))
      .filter(Boolean)
    const ids = [...new Set(senders.flatMap((s) => s.messageIds))]

    let trashed = 0
    emit({ phase: 'trashing', trashed, total: ids.length })
    for (const ids1000 of chunk(ids, BATCH_MODIFY_MAX)) {
      await limited(() =>
        gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: ids1000,
            addLabelIds: ['TRASH'],
            removeLabelIds: ['INBOX'],
          },
        })
      )
      trashed += ids1000.length
      emit({ phase: 'trashing', trashed, total: ids.length })
    }

    let storageBytes = 0
    for (const s of senders) {
      storageBytes += Number(s.totalSizeEstimate || 0)
    }
    const storageMB = Number((storageBytes / (1024 * 1024)).toFixed(1))

    for (const s of senders) scan.senders.delete(s.email)
    scan.messageCount = Math.max(0, scan.messageCount - ids.length)

    let celebration = null
    try {
      celebration = await onboardingService.triggerOnboardingCelebrationIfApplicable(userId, { emailsCleaned: ids.length, storageMB })
      await insightsService.recalculateInsights(userId)
    } catch (e) {
      console.error('⚠️ Failed celebration/insights post-trashing:', e?.message || e)
    }

    return { trashed: ids.length, senders: senders.length, celebration }
  }, userId)
}
