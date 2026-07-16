import { ScanCacheRepository, SenderCacheRepository } from '../models/index.js'
import { bytesToMB } from '../services/storageService.js'

/** Per-user in-memory scan cache. */
const caches = new Map()

/** cache shape: {scannedAt, range, messageCount, senders: Map<email, Sender>} */
export function setScan(userId, result) {
  caches.set(userId, result)

  // Asynchronously persist to PostgreSQL Tables 8 & 9
  const totalSenders = result.senders ? result.senders.size : 0
  let totalStorageBytes = 0
  if (result.senders) {
    for (const s of result.senders.values()) {
      totalStorageBytes += Number(s.totalSizeEstimate || 0)
    }
  }
  const storageUsedMb = bytesToMB(totalStorageBytes)

  // Persist scan summary to scan_cache
  ScanCacheRepository.upsert(userId, {
    totalMessages: result.messageCount || 0,
    totalSenders,
    storageUsedMb,
    lastScan: result.scannedAt || new Date().toISOString()
  }).catch(err => {
    console.error('⚠️ Failed to persist scan_cache to database:', err?.message || err)
  })

  // Persist sender rows to sender_cache
  if (result.senders && result.senders.size > 0) {
    const scanTime = result.scannedAt ? new Date(result.scannedAt) : new Date()
    const sendersArray = [...result.senders.values()].map(s => ({
      senderEmail: s.email,
      senderName: s.name,
      domain: s.domain,
      totalMessages: s.messageCount,
      storageMb: bytesToMB(s.totalSizeEstimate || 0),
      firstReceived: s.firstDate ? new Date(s.firstDate) : null,
      lastReceived: s.latestDate ? new Date(s.latestDate) : null,
      category: Object.keys(s.categoryLabelCounts || {})[0]?.replace('CATEGORY_', '') || 'Other',
    }))
    SenderCacheRepository.upsertBatch(userId, sendersArray, scanTime)
      .then(() => SenderCacheRepository.pruneStale(userId, scanTime))
      .catch(err => {
        console.error('⚠️ Failed to persist sender_cache to database:', err?.message || err)
      })
  }
}

export function getScan(userId) {
  return caches.get(userId) || null
}

export function requireScan(userId) {
  const cache = caches.get(userId)
  if (!cache) {
    const err = new Error('No scan available — run a scan first.')
    err.status = 409
    throw err
  }
  return cache
}

/**
 * Asynchronously restores a scan from PostgreSQL if missing in memory.
 * Useful after server restarts or container scaling.
 */
export async function restoreScanIfMissing(userId) {
  if (caches.has(userId)) return caches.get(userId)

  try {
    const summary = await ScanCacheRepository.getByAccountId(userId)
    if (!summary) return null

    const sendersRows = await SenderCacheRepository.listByAccountId(userId, { limit: 5000 })
    const sendersMap = new Map()

    for (const row of sendersRows) {
      sendersMap.set(row.sender_email, {
        email: row.sender_email,
        name: row.sender_name || '',
        domain: row.domain || '',
        messageCount: row.total_messages || 0,
        totalSizeEstimate: Math.round(Number(row.storage_mb || 0) * 1024 * 1024),
        messageIds: [],
        latestSubject: '',
        latestDate: row.last_received ? new Date(row.last_received).getTime() : 0,
        firstDate: row.first_received ? new Date(row.first_received).getTime() : 0,
        subjects: [],
        categoryLabelCounts: row.category ? { [`CATEGORY_${row.category.toUpperCase()}`]: 1 } : {},
        unsubscribe: { method: 'none' },
        unsubscribeDate: 0
      })
    }

    const reconstructed = {
      scannedAt: summary.last_scan ? new Date(summary.last_scan).toISOString() : new Date().toISOString(),
      range: '3m',
      messageCount: summary.total_messages || 0,
      senders: sendersMap
    }

    caches.set(userId, reconstructed)
    return reconstructed
  } catch (err) {
    console.error('⚠️ Failed to restore scan from database:', err?.message || err)
    return null
  }
}

export function clearScan(userId) {
  caches.delete(userId)
  ScanCacheRepository.deleteByAccountId(userId).catch(() => {})
  SenderCacheRepository.clearAccount(userId).catch(() => {})
}
