import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { listAllMessageIds } from '../gmail/messages.js'
import { trashMessages } from './messageTrashService.js'
import { isProtected } from './protectService.js'

const KEEP_LATEST_MAX_MESSAGES = 10_000

/**
 * Partition newest-first message IDs into keep/trash sets.
 * Gmail's messages.list returns most-recent first, so the first `keep`
 * IDs are the ones to retain.
 */
export function partitionKeepLatest(newestFirstIds, keep) {
  const n = Math.max(0, Math.floor(keep))
  return {
    keep: newestFirstIds.slice(0, n),
    toTrash: newestFirstIds.slice(n),
  }
}

/**
 * Job runner: keep the `keep` newest emails from one sender, trash the rest.
 * Refuses protected senders. Never permanent-deletes (Gmail Trash only).
 */
export async function runKeepLatest({ senderEmail, keep }, emit) {
  return withAuthErrorHandling(async () => {
    const email = String(senderEmail).toLowerCase()
    if (await isProtected(email)) {
      return { protected: true, senderEmail: email, trashed: 0, kept: 0, capped: false }
    }

    const gmail = await getGmail()
    emit?.({ phase: 'listing', listed: 0 })
    // Gmail returns newest-first; listAllMessageIds preserves that paging order.
    const ids = await listAllMessageIds(
      gmail,
      `from:${email} -in:trash -in:spam`,
      {
        maxMessages: KEEP_LATEST_MAX_MESSAGES,
        onProgress: (p) => emit?.({ phase: 'listing', ...p }),
      }
    )
    const capped = ids.length >= KEEP_LATEST_MAX_MESSAGES

    const { keep: kept, toTrash } = partitionKeepLatest(ids, keep)
    if (toTrash.length === 0) {
      return { protected: false, senderEmail: email, trashed: 0, kept: kept.length, capped }
    }

    emit?.({ phase: 'trashing', trashed: 0, total: toTrash.length })
    const res = await trashMessages(toTrash, emit)
    return { protected: false, senderEmail: email, trashed: res.trashed, kept: kept.length, capped }
  })
}
