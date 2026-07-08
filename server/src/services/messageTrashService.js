import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'

const BATCH_MAX = 1000

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Move specific message IDs to Trash (recoverable for 30 days — never permanent delete).
 * For small batches (<= 1000) this is synchronous; for large batches the caller
 * should use a job. Returns { trashed: number }.
 */
export async function trashMessages(messageIds, emit) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
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

    return { trashed: ids.length }
  })
}
