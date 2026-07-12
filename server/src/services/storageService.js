import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'

export function bytesToMB(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100
}

export const SIZE_BANDS = [
  { key: '0-200k', label: '0 – 200 KB', minBytes: 0, maxBytes: 204_800 },
  { key: '200k-500k', label: '200 KB – 500 KB', minBytes: 204_800, maxBytes: 512_000 },
  { key: '500k-1m', label: '500 KB – 1 MB', minBytes: 512_000, maxBytes: 1_048_576 },
  { key: '1m-5m', label: '1 – 5 MB', minBytes: 1_048_576, maxBytes: 5_242_880 },
  { key: '5m-10m', label: '5 – 10 MB', minBytes: 5_242_880, maxBytes: 10_485_760 },
  { key: '10m-25m', label: '10 – 25 MB', minBytes: 10_485_760, maxBytes: 26_214_400 },
  { key: 'gt25m', label: '> 25 MB', minBytes: 26_214_400, maxBytes: Infinity },
]

export function aggregateBySender(messages, limit = 10) {
  const map = new Map()
  for (const m of messages) {
    const email = m.from.toLowerCase()
    let entry = map.get(email)
    if (!entry) {
      entry = { email, name: m.from, totalBytes: 0, messageCount: 0 }
      map.set(email, entry)
    }
    entry.totalBytes += m.sizeEstimate
    entry.messageCount++
  }
  return [...map.values()]
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, limit)
    .map(e => ({ email: e.email, name: e.name, totalMB: bytesToMB(e.totalBytes), messageCount: e.messageCount }))
}

export function aggregateByMonth(messages) {
  const map = new Map()
  for (const m of messages) {
    const d = new Date(m.date)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    let entry = map.get(month)
    if (!entry) {
      entry = { month, totalBytes: 0, messageCount: 0 }
      map.set(month, entry)
    }
    entry.totalBytes += m.sizeEstimate
    entry.messageCount++
  }
  return [...map.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map(e => ({ month: e.month, totalMB: bytesToMB(e.totalBytes), messageCount: e.messageCount }))
}

export function aggregateByYear(messages) {
  const map = new Map()
  for (const m of messages) {
    const year = String(new Date(m.date).getFullYear())
    let entry = map.get(year)
    if (!entry) {
      entry = { year, totalBytes: 0, messageCount: 0 }
      map.set(year, entry)
    }
    entry.totalBytes += m.sizeEstimate
    entry.messageCount++
  }
  return [...map.values()]
    .sort((a, b) => b.year.localeCompare(a.year))
    .map(e => ({ year: e.year, totalMB: bytesToMB(e.totalBytes), messageCount: e.messageCount }))
}

export function aggregateBySizeBand(messages) {
  const counts = new Map(SIZE_BANDS.map(b => [b.key, { totalBytes: 0, messageCount: 0 }]))
  for (const m of messages) {
    const band = SIZE_BANDS.find(b => m.sizeEstimate >= b.minBytes && m.sizeEstimate < b.maxBytes)
    if (!band) continue
    const entry = counts.get(band.key)
    entry.totalBytes += m.sizeEstimate
    entry.messageCount++
  }
  return SIZE_BANDS.map(b => {
    const e = counts.get(b.key)
    return { key: b.key, label: b.label, totalMB: bytesToMB(e.totalBytes), messageCount: e.messageCount }
  })
}

export function filterLargeAttachments(messages, minSizeMB = 5) {
  const minBytes = minSizeMB * 1024 * 1024
  return messages
    .filter(m => m.hasAttachment && m.sizeEstimate >= minBytes)
    .sort((a, b) => b.sizeEstimate - a.sizeEstimate)
    .map(m => ({
      id: m.id,
      from: m.from,
      subject: m.subject,
      sizeMB: bytesToMB(m.sizeEstimate),
      date: m.date,
    }))
}

// In-memory cache per user — full scan of large messages is expensive
const caches = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchLargeMessages(gmail, emit) {
  const messages = []
  let pageToken
  let listed = 0
  do {
    const res = await limited(() =>
      gmail.users.messages.list({
        userId: 'me',
        q: 'larger:250K -in:trash -in:spam',
        maxResults: 500,
        pageToken,
      })
    )
    const ids = (res.data.messages || []).map(m => m.id)
    if (ids.length === 0) break

    const batch = await Promise.all(
      ids.map(id =>
        limited(() =>
          gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject'],
          })
        ).then(r => {
          const headers = {}
          for (const h of r.data.payload?.headers || []) {
            headers[h.name.toLowerCase()] = h.value
          }
          return {
            id: r.data.id,
            from: headers['from'] || '',
            subject: headers['subject'] || '',
            sizeEstimate: r.data.sizeEstimate || 0,
            date: Number(r.data.internalDate || 0),
            hasAttachment: (r.data.payload?.mimeType || '').includes('multipart'),
          }
        }).catch(() => null)
      )
    )

    messages.push(...batch.filter(Boolean))
    listed += ids.length
    pageToken = res.data.nextPageToken
    if (emit) emit({ phase: 'analyzing', processed: listed })
  } while (pageToken)

  return messages
}

export async function getStorageStats(userId, emit) {
  return withAuthErrorHandling(async () => {
    const now = Date.now()
    const userCache = caches.get(userId)
    if (userCache && (now - userCache.time) < CACHE_TTL) return userCache.data

    const gmail = await getGmail(userId)
    const messages = await fetchLargeMessages(gmail, emit)

    const totalBytes = messages.reduce((sum, m) => sum + m.sizeEstimate, 0)
    const stats = {
      totalMB: bytesToMB(totalBytes),
      messageCount: messages.length,
      senders: aggregateBySender(messages, 10),
      months: aggregateByMonth(messages),
      years: aggregateByYear(messages),
      sizes: aggregateBySizeBand(messages),
      attachments: filterLargeAttachments(messages, 5),
    }
    caches.set(userId, { data: stats, time: now, _messages: messages })
    return stats
  }, userId)
}

/**
 * Return individual messages for a sender or month drill-down.
 * Requires the cache to be warm — call getStorageStats() first.
 * by: 'sender' → filter by from email (lowercase match)
 * by: 'month'  → filter by YYYY-MM month string
 */
export function getDrillDownMessages(userId, by, value) {
  const userCache = caches.get(userId)
  if (!userCache || !userCache._messages) return null   // cache not warm
  const messages = userCache._messages

  if (by === 'sender') {
    const v = value.toLowerCase()
    return messages
      .filter(m => m.from.toLowerCase().includes(v))
      .sort((a, b) => b.sizeEstimate - a.sizeEstimate)
      .map(m => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        sizeMB: bytesToMB(m.sizeEstimate),
        date: m.date,
        hasAttachment: m.hasAttachment,
      }))
  }

  if (by === 'month') {
    return messages
      .filter(m => {
        const d = new Date(m.date)
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return month === value
      })
      .sort((a, b) => b.sizeEstimate - a.sizeEstimate)
      .map(m => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        sizeMB: bytesToMB(m.sizeEstimate),
        date: m.date,
        hasAttachment: m.hasAttachment,
      }))
  }

  if (by === 'year') {
    return messages
      .filter(m => String(new Date(m.date).getFullYear()) === value)
      .sort((a, b) => b.sizeEstimate - a.sizeEstimate)
      .map(m => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        sizeMB: bytesToMB(m.sizeEstimate),
        date: m.date,
        hasAttachment: m.hasAttachment,
      }))
  }

  if (by === 'size') {
    const band = SIZE_BANDS.find(b => b.key === value)
    if (!band) return []
    return messages
      .filter(m => m.sizeEstimate >= band.minBytes && m.sizeEstimate < band.maxBytes)
      .sort((a, b) => b.sizeEstimate - a.sizeEstimate)
      .map(m => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        sizeMB: bytesToMB(m.sizeEstimate),
        date: m.date,
        hasAttachment: m.hasAttachment,
      }))
  }

  return []
}

export function clearStorageCache(userId) {
  if (userId) {
    caches.delete(userId)
  } else {
    caches.clear()
  }
}
