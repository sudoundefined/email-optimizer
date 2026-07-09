import { RECURRING_VENDORS } from './categorizer.js'

/**
 * Heuristic recurring-service detection over scan metadata — no body reads, no
 * network. Matches senders against RECURRING_VENDORS (shared with the
 * categorizer's Subscriptions label) and estimates billing cadence from the
 * span between a sender's first and last message.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Match a sender to a known vendor. Domain match (exact/parent) is stronger
 * than a name/display match; returns the vendor label or null. */
export function matchVendor(sender) {
  const domain = String(sender?.domain || '').toLowerCase()
  const hay = `${sender?.name || ''} ${sender?.email || ''}`.toLowerCase()
  // Prefer domain matches (narrow, subscription-only).
  for (const v of RECURRING_VENDORS) {
    if (v.domains.some((d) => domain === d || domain.endsWith('.' + d))) return v.vendor
  }
  // Fall back to display-name / address patterns (covers broad platforms whose
  // bare domains are intentionally excluded from `domains`).
  for (const v of RECURRING_VENDORS) {
    if (v.namePatterns.some((p) => hay.includes(p))) return v.vendor
  }
  return null
}

/** Classify billing cadence from average gap between messages. */
export function estimateCadence({ firstDate, latestDate, messageCount }) {
  if (!messageCount || messageCount < 2 || !firstDate || !latestDate || latestDate <= firstDate) {
    return 'unknown'
  }
  const avgGapDays = (latestDate - firstDate) / (messageCount - 1) / DAY_MS
  if (avgGapDays <= 10) return 'weekly'
  if (avgGapDays <= 45) return 'monthly'
  if (avgGapDays <= 100) return 'quarterly'
  return 'annual'
}

/**
 * detectSubscriptions(senders) — senders is the scan cache's Map<email, sender>
 * (or any iterable of sender objects). Returns detected subscriptions, one per
 * matched sender, most-recent first.
 */
export function detectSubscriptions(senders) {
  const list = senders instanceof Map ? [...senders.values()] : [...(senders || [])]
  const out = []
  for (const s of list) {
    const vendor = matchVendor(s)
    if (!vendor) continue
    out.push({
      vendor,
      email: s.email,
      name: s.name || s.email,
      domain: s.domain || '',
      messageCount: s.messageCount || 0,
      cadence: estimateCadence(s),
      lastSeen: s.latestDate || 0,
      method: s.unsubscribe?.method || 'none',
    })
  }
  return out.sort((a, b) => b.lastSeen - a.lastSeen)
}
