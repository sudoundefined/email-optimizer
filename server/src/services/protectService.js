import { getDb } from '../db/db.js'

export const PROTECTED_DOMAINS = [
  'chase.com', 'wellsfargo.com', 'bankofamerica.com', 'citi.com', 'capitalone.com',
  'paypal.com', 'venmo.com', 'zelle.com', 'stripe.com',
  'irs.gov', 'uscis.gov', 'ssa.gov', 'usps.com',
  'pge.com', 'sce.com', 'att.com', 'verizon.com', 'tmobile.com', 'xfinity.com', 'comcast.com',
  'amazon.com', 'apple.com', 'google.com', 'microsoft.com',
  'fidelity.com', 'schwab.com', 'vanguard.com', 'etrade.com',
  'geico.com', 'statefarm.com', 'progressive.com', 'allstate.com',
]

export const PROTECTED_SUBJECT_KEYWORDS = [
  'statement', 'invoice', 'receipt', 'bill', 'payment due', 'payment received',
  'tax return', 'tax document', 'w-2', '1099', 'account alert', 'security alert',
  'direct deposit', 'wire transfer', 'insurance',
]

export function matchesDomainHeuristic(domain) {
  const d = domain.toLowerCase()
  return PROTECTED_DOMAINS.some(pd => d === pd || d.endsWith('.' + pd))
}

export function matchesSubjectHeuristic(subjects) {
  if (!subjects || subjects.length === 0) return false
  return subjects.some(s => {
    const lower = s.toLowerCase()
    return PROTECTED_SUBJECT_KEYWORDS.some(kw => lower.includes(kw))
  })
}

/**
 * Analyze scan results and return senders that should be auto-protected.
 * Returns [{email, domain, reason: 'auto:domain'|'auto:subject'}]
 */
export function autoProtectFromScan(senders) {
  const results = []
  for (const [, sender] of senders) {
    if (matchesDomainHeuristic(sender.domain)) {
      results.push({ email: sender.email, domain: sender.domain, reason: 'auto:domain' })
    } else if (matchesSubjectHeuristic(sender.subjects)) {
      results.push({ email: sender.email, domain: sender.domain, reason: 'auto:subject' })
    }
  }
  return results
}

export function listProtected(userId) {
  const db = getDb()
  return db.prepare(`
    SELECT email, domain, source as reason, added_at as addedAt
    FROM protected_senders
    WHERE user_id = ?
    ORDER BY added_at DESC
  `).all(userId)
}

export function protectSenders(userId, emails) {
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO protected_senders (user_id, email, domain, source, added_at)
    VALUES (?, ?, ?, 'manual', datetime('now'))
  `)
  const transaction = db.transaction((emailsList) => {
    for (const email of emailsList) {
      const lower = email.toLowerCase()
      const domain = lower.split('@')[1] || ''
      insert.run(userId, lower, domain)
    }
  })
  transaction(emails)
  return listProtected(userId)
}

export function unprotectSenders(userId, emails) {
  const db = getDb()
  const del = db.prepare(`
    DELETE FROM protected_senders
    WHERE user_id = ? AND LOWER(email) = ?
  `)
  const transaction = db.transaction((emailsList) => {
    for (const email of emailsList) {
      del.run(userId, email.toLowerCase())
    }
  })
  transaction(emails)
  return listProtected(userId)
}

export function isProtected(userId, email) {
  const db = getDb()
  const row = db.prepare(`
    SELECT 1 FROM protected_senders
    WHERE user_id = ? AND LOWER(email) = ?
  `).get(userId, email.toLowerCase())
  return Boolean(row)
}

/**
 * Run auto-protect after a scan, merging new auto-detections
 * into SQLite (won't duplicate existing entries).
 */
export function runAutoProtect(userId, senders) {
  const detected = autoProtectFromScan(senders)
  if (detected.length === 0) return []
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO protected_senders (user_id, email, domain, source, added_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `)
  const added = []
  const transaction = db.transaction(() => {
    for (const d of detected) {
      const lower = d.email.toLowerCase()
      const result = insert.run(userId, lower, d.domain || '', d.reason)
      if (result.changes > 0) {
        added.push(d)
      }
    }
  })
  transaction()
  return added
}

/**
 * Filter out protected senders from an email list.
 * Returns {allowed: string[], excluded: string[]}
 */
export function filterProtected(userId, senderEmails) {
  const list = listProtected(userId)
  const protectedSet = new Set(list.map(p => p.email.toLowerCase()))
  const allowed = []
  const excluded = []
  for (const email of senderEmails) {
    if (protectedSet.has(email.toLowerCase())) excluded.push(email)
    else allowed.push(email)
  }
  return { allowed, excluded }
}
