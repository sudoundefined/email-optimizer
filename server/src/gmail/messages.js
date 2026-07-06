import { limited } from './rateLimiter.js'

/**
 * Lists message ids matching a Gmail search query, paginating until
 * exhaustion or maxMessages.
 */
export async function listAllMessageIds(gmail, q, { maxMessages = 5000, onProgress } = {}) {
  const ids = new Set()
  let pageToken
  do {
    const res = await limited(() =>
      gmail.users.messages.list({
        userId: 'me',
        q,
        maxResults: 500,
        pageToken,
      })
    )
    for (const m of res.data.messages || []) ids.add(m.id)
    pageToken = res.data.nextPageToken
    onProgress?.({ listed: ids.size })
  } while (pageToken && ids.size < maxMessages)
  return [...ids].slice(0, maxMessages)
}

const METADATA_HEADERS = ['From', 'Subject', 'Date', 'List-Unsubscribe', 'List-Unsubscribe-Post']

/**
 * Fetches metadata (headers + labelIds) for message ids.
 * Returns array of {id, internalDate, labelIds, headers: {name: value}}.
 * Individual failures are skipped rather than aborting the whole fetch.
 */
export async function getMetadata(gmail, ids, { onProgress } = {}) {
  let fetched = 0
  const results = await Promise.all(
    ids.map((id) =>
      limited(() =>
        gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: METADATA_HEADERS,
        })
      )
        .then((res) => {
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
