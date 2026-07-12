import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { listAllMessageIds } from '../gmail/messages.js'
import { trashMessages } from './messageTrashService.js'
import { isProtected } from './protectService.js'
import { logActivity } from './auditService.js'

const KEEP_LATEST_MAX_MESSAGES = 10_000

// Reject anything that isn't a plain email address so it can't smuggle Gmail
// search operators (spaces, quotes, braces, colons, angle brackets) into the
// `from:` query that drives a destructive trash.
const SENDER_EMAIL_RE = /^[^\s@"'<>{}():]+@[^\s@"'<>{}():]+\.[^\s@"'<>{}():]+$/

export function isValidSenderEmail(value) {
  return typeof value === 'string' && SENDER_EMAIL_RE.test(value.trim())
}

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
export async function runKeepLatest(userId, { senderEmail, keep }, emit) {
  return withAuthErrorHandling(async () => {
    const email = String(senderEmail).toLowerCase()
    if (isProtected(userId, email)) {
      return { protected: true, senderEmail: email, trashed: 0, kept: 0, capped: false }
    }

    const gmail = await getGmail(userId)
    emit?.({ phase: 'listing', listed: 0 })
    // Gmail returns newest-first; listAllMessageIds preserves that paging order.
    // Quote the address so any residual special chars are a literal string, not
    // Gmail query operators. Fetch one past the cap purely to detect truncation.
    const ids = await listAllMessageIds(
      gmail,
      `from:"${email}" -in:trash -in:spam`,
      {
        maxMessages: KEEP_LATEST_MAX_MESSAGES + 1,
        onProgress: (p) => emit?.({ phase: 'listing', ...p }),
      }
    )
    const capped = ids.length > KEEP_LATEST_MAX_MESSAGES
    const scanIds = capped ? ids.slice(0, KEEP_LATEST_MAX_MESSAGES) : ids

    const { keep: kept, toTrash } = partitionKeepLatest(scanIds, keep)
    if (toTrash.length === 0) {
      logActivity(userId, 'keep_latest', { senderEmail: email, kept: kept.length, trashed: 0 })
      return { protected: false, senderEmail: email, trashed: 0, kept: kept.length, capped }
    }

    emit?.({ phase: 'trashing', trashed: 0, total: toTrash.length })
    const res = await trashMessages(userId, toTrash, emit)
    logActivity(userId, 'keep_latest', { senderEmail: email, kept: kept.length, trashed: res.trashed })
    return { protected: false, senderEmail: email, trashed: res.trashed, kept: kept.length, capped }
  }, userId)
}
