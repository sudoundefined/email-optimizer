import { limited } from './rateLimiter.js'
import { getEffectiveScanLimits } from '../utils/preferences.js'

/**
 * Lists message ids matching a Gmail search query and/or labelIds, paginating until
 * exhaustion or maxMessages limit from the DB.
 */
export async function listMessagesPaginated(gmail, { q, labelIds, maxMessages, onProgress, signal, userId } = {}) {
  const limits = await getEffectiveScanLimits(userId)
  const effectiveMax = maxMessages !== undefined ? maxMessages : limits.maxMessages
  const ids = new Set()
  let pageToken
  do {
    if (signal?.aborted) break
    const remaining = effectiveMax - ids.size
    if (remaining <= 0) break
    const res = await limited(() =>
      gmail.users.messages.list({
        userId: 'me',
        ...(q ? { q } : {}),
        ...(labelIds && labelIds.length > 0 ? { labelIds } : {}),
        maxResults: Math.min(limits.maxMessages, remaining, 500),
        pageToken,
      })
    )
    for (const m of res.data.messages || []) ids.add(m.id)
    pageToken = res.data.nextPageToken
    onProgress?.({ listed: ids.size })
  } while (pageToken && ids.size < effectiveMax && !signal?.aborted)
  return [...ids].slice(0, effectiveMax)
}

/**
 * Lists message ids matching a Gmail search query, paginating until
 * exhaustion or maxMessages limit from the DB.
 */
export async function listAllMessageIds(gmail, q, { maxMessages, onProgress, signal, userId } = {}) {
  return listMessagesPaginated(gmail, { q, maxMessages, onProgress, signal, userId })
}

const METADATA_HEADERS = ['From', 'Subject', 'Date', 'List-Unsubscribe', 'List-Unsubscribe-Post']

/**
 * Fetches metadata (headers + labelIds) for message ids.
 * Returns array of {id, internalDate, labelIds, headers: {name: value}}.
 * Individual failures are skipped rather than aborting the whole fetch.
 */
export async function getMetadata(gmail, ids, { onProgress, signal } = {}) {
  let fetched = 0
  const results = await Promise.all(
    ids.map((id) =>
      limited(() => {
        if (signal?.aborted) return null // skip queued fetches once cancelled
        return gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: METADATA_HEADERS,
        })
      })
        .then((res) => {
          if (!res) return null
          const headers = {}
          for (const h of res.data.payload?.headers || []) {
            // last occurrence wins; these headers don't legitimately repeat
            headers[h.name.toLowerCase()] = h.value
          }
          return {
            id: res.data.id,
            internalDate: Number(res.data.internalDate || 0),
            labelIds: res.data.labelIds || [],
            headers,
            sizeEstimate: res.data.sizeEstimate || 0,
          }
        })
        .catch(() => null)
        .finally(() => {
          fetched++
          if (fetched % 50 === 0 || fetched === ids.length) {
            onProgress?.({ fetched, total: ids.length })
          }
        })
    )
  )
  return results.filter(Boolean)
}
