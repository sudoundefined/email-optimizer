import { getGmail } from '../gmail/client.js'
import { listAllMessageIds, getMetadata } from '../gmail/messages.js'
import { parseFrom, unsubscribeInfo, METHOD_RANK } from './headerParser.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { setScan } from '../store/scanCache.js'
import { ScanMetadataRepository } from '../models/index.js'
import { config } from '../config.js'
import { bytesToMB } from './storageService.js'
import { getEffectiveScanLimits } from '../utils/preferences.js'
import { SCAN_DEFAULTS, LIST_LIMITS } from '../utils/constants.js'
import { onboardingService } from './onboardingService.js'
import { insightsService } from './insightsService.js'
import { PreferenceRepository } from '../models/PreferenceRepository.js'

const RANGE_TO_QUERY = {
  '1m': 'newer_than:1m',
  '3m': 'newer_than:3m',
  '6m': 'newer_than:6m',
  '1y': 'newer_than:1y',
  all: '',
}

export function buildQuery(range) {
  const newer = RANGE_TO_QUERY[range] ?? RANGE_TO_QUERY['6m']
  const base =
    '(category:promotions OR category:updates OR category:social OR category:forums OR "unsubscribe")' +
    ' -in:chats -in:trash -in:spam'
  return newer ? `${base} ${newer}` : base
}

/**
 * Scan core: list candidate messages, fetch metadata, group by sender,
 * determine each sender's best unsubscribe method. Returns the scan result
 * WITHOUT caching it — callers decide whether to persist (runScan does;
 * the digest runner does not, so it never clobbers the Senders-tab scan).
 */
export async function scanSenders(userId, opts = {}, emit, signal) {
  return withAuthErrorHandling(async () => {
    const limits = await getEffectiveScanLimits(userId)
    const range = opts.range || limits.timeRange || SCAN_DEFAULTS.TIME_RANGE
    const maxMessages = opts.maxMessages !== undefined ? opts.maxMessages : limits.maxMessages
    const gmail = await getGmail(userId)
    const throwIfAborted = () => {
      if (signal?.aborted) throw new Error('cancelled')
    }

    emit({ phase: 'listing', listed: 0 })
    const ids = await listAllMessageIds(gmail, buildQuery(range), {
      maxMessages,
      userId,
      signal,
      onProgress: (p) => emit({ phase: 'listing', ...p }),
    })
    throwIfAborted()

    emit({ phase: 'fetching', fetched: 0, total: ids.length })
    const messages = await getMetadata(gmail, ids, {
      signal,
      onProgress: (p) => emit({ phase: 'fetching', ...p }),
    })
    throwIfAborted()

    emit({ phase: 'grouping', total: messages.length })
    const senders = new Map()
    for (const msg of messages) {
      const { name, email } = parseFrom(msg.headers['from'])
      if (!email) continue
      let s = senders.get(email)
      if (!s) {
        s = {
          email,
          name,
          domain: email.split('@')[1] || '',
          messageCount: 0,
          totalSizeEstimate: 0,
          messageIds: [],
          latestSubject: '',
          latestDate: 0,
          firstDate: 0,
          subjects: [],
          categoryLabelCounts: {},
          unsubscribe: { method: 'none' },
          unsubscribeDate: 0,
        }
        senders.set(email, s)
      }
      s.messageCount++
      s.totalSizeEstimate += msg.sizeEstimate || 0
      s.messageIds.push(msg.id)
      if (s.subjects.length < 20 && msg.headers['subject']) {
        s.subjects.push(msg.headers['subject'])
      }
      if (msg.internalDate > s.latestDate) {
        s.latestDate = msg.internalDate
        s.latestSubject = msg.headers['subject'] || ''
        if (name && !s.name) s.name = name
      }
      if (msg.internalDate && (s.firstDate === 0 || msg.internalDate < s.firstDate)) {
        s.firstDate = msg.internalDate
      }
      for (const label of msg.labelIds) {
        if (label.startsWith('CATEGORY_')) {
          s.categoryLabelCounts[label] = (s.categoryLabelCounts[label] || 0) + 1
        }
      }
      // keep the best method; among equal methods prefer the newest message's URIs
      const info = unsubscribeInfo(msg.headers)
      const better =
        METHOD_RANK[info.method] > METHOD_RANK[s.unsubscribe.method] ||
        (METHOD_RANK[info.method] === METHOD_RANK[s.unsubscribe.method] &&
          info.method !== 'none' &&
          msg.internalDate > s.unsubscribeDate)
      if (better) {
        s.unsubscribe = info
        s.unsubscribeDate = msg.internalDate
      }
    }

    return {
      scannedAt: new Date().toISOString(),
      range,
      messageCount: messages.length,
      senders,
    }
  }, userId)
}

/**
 * Scan job runner: run scanSenders and cache the result for the Senders tab.
 * Also records timing, counts, and status (`success`, `failed`, `cancelled`) to scan_metadata table.
 */
export async function runScan(userId, opts, emit, signal) {
  const startedAt = new Date()
  try {
    const result = await scanSenders(userId, opts, emit, signal)
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()

    ScanMetadataRepository.record(userId, {
      startedAt,
      completedAt,
      emailsScanned: result.messageCount,
      sendersFound: result.senders.size,
      durationMs,
      status: 'success',
      errorMessage: null
    }).catch(err => console.error('⚠️ Failed to record scan_metadata:', err?.message || err))

    setScan(userId, result)

    // Onboarding & Insights hooks
    try {
      await onboardingService.autoSeedProtectedCategories(userId, result.senders)
      await insightsService.calculateAndStoreInsights(userId)
      const prefs = await PreferenceRepository.get(userId)
      if (!prefs.has_completed_onboarding && prefs.onboarding_step === 'scanning') {
        await PreferenceRepository.update(userId, { onboarding_step: 'story' })
      }
    } catch (hookErr) {
      console.error('⚠️ Post-scan hooks (onboarding/insights) failed:', hookErr?.message || hookErr)
    }

    return { senders: result.senders.size, messages: result.messageCount }
  } catch (err) {
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()
    const status = err.message === 'cancelled' || signal?.aborted ? 'cancelled' : 'failed'

    ScanMetadataRepository.record(userId, {
      startedAt,
      completedAt,
      emailsScanned: 0,
      sendersFound: 0,
      durationMs,
      status,
      errorMessage: err?.message || 'Scan failed'
    }).catch(e => console.error('⚠️ Failed to record error scan_metadata:', e?.message || e))

    throw err
  }
}

/** Serializable view of the scan for the API (senders sorted by count desc). */
export function scanView(scan) {
  const allSenders = [...scan.senders.values()]
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, LIST_LIMITS.SENDERS_DEFAULT)
    .map((s) => ({
      email: s.email,
      name: (s.name || '').slice(0, 60),
      domain: s.domain,
      messageCount: s.messageCount,
      latestSubject: (s.latestSubject || '').slice(0, 100),
      latestDate: s.latestDate,
      method: s.unsubscribe.method,
      sizeMB: bytesToMB(s.totalSizeEstimate || 0),
    }))

  return {
    scannedAt: scan.scannedAt,
    range: scan.range,
    messageCount: scan.messageCount,
    senders: allSenders,
  }
}
