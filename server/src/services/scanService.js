import { getGmail } from '../gmail/client.js'
import { listAllMessageIds, getMetadata } from '../gmail/messages.js'
import { parseFrom, unsubscribeInfo, METHOD_RANK } from './headerParser.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { setScan } from '../store/scanCache.js'
import { config } from '../config.js'

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
export async function scanSenders({ range = '6m', maxMessages = config.scanMaxMessages }, emit) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()

    emit({ phase: 'listing', listed: 0 })
    const ids = await listAllMessageIds(gmail, buildQuery(range), {
      maxMessages,
      onProgress: (p) => emit({ phase: 'listing', ...p }),
    })

    emit({ phase: 'fetching', fetched: 0, total: ids.length })
    const messages = await getMetadata(gmail, ids, {
      onProgress: (p) => emit({ phase: 'fetching', ...p }),
    })

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
          messageIds: [],
          latestSubject: '',
          latestDate: 0,
          subjects: [],
          categoryLabelCounts: {},
          unsubscribe: { method: 'none' },
          unsubscribeDate: 0,
        }
        senders.set(email, s)
      }
      s.messageCount++
      s.messageIds.push(msg.id)
      if (s.subjects.length < 20 && msg.headers['subject']) {
        s.subjects.push(msg.headers['subject'])
      }
      if (msg.internalDate > s.latestDate) {
        s.latestDate = msg.internalDate
        s.latestSubject = msg.headers['subject'] || ''
        if (name && !s.name) s.name = name
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
  })
}

/**
 * Scan job runner: run scanSenders and cache the result for the Senders tab.
 */
export async function runScan(opts, emit) {
  const result = await scanSenders(opts, emit)
  setScan(result)
  return { senders: result.senders.size, messages: result.messageCount }
}

/** Serializable view of the scan for the API (senders sorted by count desc). */
export function scanView(scan) {
  return {
    scannedAt: scan.scannedAt,
    range: scan.range,
    messageCount: scan.messageCount,
    senders: [...scan.senders.values()]
      .sort((a, b) => b.messageCount - a.messageCount)
      .map((s) => ({
        email: s.email,
        name: s.name,
        domain: s.domain,
        messageCount: s.messageCount,
        latestSubject: s.latestSubject,
        latestDate: s.latestDate,
        method: s.unsubscribe.method,
      })),
  }
}
