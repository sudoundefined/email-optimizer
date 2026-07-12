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

    return { trashed: ids.length }
  }, userId)
}

/**
 * Permanently delete all messages currently in the Trash.
 */
export async function emptyTrash(userId, emit) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail(userId)
    let deleted = 0
    let pageToken = undefined

    do {
      const res = await limited(() =>
        gmail.users.messages.list({
          userId: 'me',
          q: 'in:trash',
          maxResults: BATCH_MAX,
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
    } while (pageToken)

    return { deleted }
  }, userId)
}
