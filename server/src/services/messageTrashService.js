import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'
import { getEffectiveScanLimits } from '../utils/preferences.js'
import { onboardingService } from './onboardingService.js'
import { insightsService } from './insightsService.js'

const BATCH_MAX = 1000

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Move specific message IDs to Trash (recoverable for 30 days — never permanent delete).
 * For small batches (<= 1000) this is synchronous; for large batches the caller
 * should use a job. Returns { trashed: number, celebration: object | null }.
 */
export async function trashMessages(userId, messageIds, emit) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail(userId)
    const ids = [...new Set(messageIds)]
    let trashed = 0

    if (emit) emit({ phase: 'trashing', trashed, total: ids.length })

    for (const batch of chunk(ids, BATCH_MAX)) {
      await limited(() =>
        gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: batch,
            addLabelIds: ['TRASH'],
            removeLabelIds: ['INBOX'],
          },
        })
      )
      trashed += batch.length
      if (emit) emit({ phase: 'trashing', trashed, total: ids.length })
    }

    let celebration = null
    try {
      celebration = await onboardingService.triggerOnboardingCelebrationIfApplicable(userId, { emailsCleaned: ids.length, storageMB: Number((ids.length * 0.1).toFixed(1)) })
      await insightsService.recalculateInsights(userId)
    } catch (e) {
      console.error('⚠️ Failed celebration/insights post-trashMessages:', e?.message || e)
    }

    return { trashed: ids.length, celebration }
  }, userId)
}

/**
 * Permanently delete all messages currently in the Trash.
 */
export async function emptyTrash(userId, emit) {
  return withAuthErrorHandling(async () => {
    const limits = await getEffectiveScanLimits(userId)
    const gmail = await getGmail(userId)
    let deleted = 0
    let pageToken = undefined

    do {
      const remaining = limits.maxMessages - deleted
      if (remaining <= 0) break
      const res = await limited(() =>
        gmail.users.messages.list({
          userId: 'me',
          q: 'in:trash',
          maxResults: Math.min(500, remaining),
          pageToken,
        })
      )
      const msgs = res.data.messages || []
      if (msgs.length > 0) {
        const ids = msgs.map((m) => m.id)
        await limited(() =>
          gmail.users.messages.batchDelete({
            userId: 'me',
            requestBody: { ids },
          })
        )
        deleted += ids.length
        if (emit) emit({ phase: 'emptying', deleted })
      }
      pageToken = res.data.nextPageToken
    } while (pageToken && deleted < limits.maxMessages)

    return { deleted }
  }, userId)
}
