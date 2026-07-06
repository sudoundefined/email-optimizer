import fs from 'node:fs/promises'
import { config } from '../config.js'

let overridePath = null
function filePath() { return overridePath || config.protectedSendersPath }
export function _setPathForTest(p) { overridePath = p }

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
 * Returns [{email, reason: 'auto:domain'|'auto:subject'}]
 */
export function autoProtectFromScan(senders) {
  const results = []
  for (const [, sender] of senders) {
    if (matchesDomainHeuristic(sender.domain)) {
      results.push({ email: sender.email, reason: 'auto:domain' })
    } else if (matchesSubjectHeuristic(sender.subjects)) {
      results.push({ email: sender.email, reason: 'auto:subject' })
    }
  }
  return results
}

async function readFile() {
  try {
    const raw = await fs.readFile(filePath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return { protected: [] }
  }
}

async function writeFile(data) {
  const dir = filePath().replace(/[/\\][^/\\]+$/, '')
  await fs.mkdir(dir, { recursive: true })
  const tmp = filePath() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, filePath())
}

export async function listProtected() {
  const data = await readFile()
  return data.protected || []
}

export async function protectSenders(emails) {
  const data = await readFile()
  const existing = new Set((data.protected || []).map(p => p.email.toLowerCase()))
  const now = new Date().toISOString()
  for (const email of emails) {
    const lower = email.toLowerCase()
    if (!existing.has(lower)) {
      data.protected.push({ email: lower, reason: 'manual', addedAt: now })
      existing.add(lower)
    }
  }
  await writeFile(data)
  return data.protected
}

export async function unprotectSenders(emails) {
  const data = await readFile()
  const toRemove = new Set(emails.map(e => e.toLowerCase()))
  data.protected = (data.protected || []).filter(p => !toRemove.has(p.email.toLowerCase()))
  await writeFile(data)
  return data.protected
}

export async function isProtected(email) {
  const list = await listProtected()
  const lower = email.toLowerCase()
  return list.some(p => p.email.toLowerCase() === lower)
}

/**
 * Run auto-protect after a scan, merging new auto-detections
 * into the persisted list (won't duplicate existing entries).
 */
export async function runAutoProtect(senders) {
  const detected = autoProtectFromScan(senders)
  if (detected.length === 0) return []
  const data = await readFile()
  const existing = new Set((data.protected || []).map(p => p.email.toLowerCase()))
  const now = new Date().toISOString()
  const added = []
  for (const d of detected) {
    const lower = d.email.toLowerCase()
    if (!existing.has(lower)) {
      data.protected.push({ email: lower, reason: d.reason, addedAt: now })
      existing.add(lower)
      added.push(d)
    }
  }
  if (added.length > 0) await writeFile(data)
  return added
}

/**
 * Filter out protected senders from an email list.
 * Returns {allowed: string[], excluded: string[]}
 */
export async function filterProtected(senderEmails) {
  const list = await listProtected()
  const protectedSet = new Set(list.map(p => p.email.toLowerCase()))
  const allowed = []
  const excluded = []
  for (const email of senderEmails) {
    if (protectedSet.has(email.toLowerCase())) excluded.push(email)
    else allowed.push(email)
  }
  return { allowed, excluded }
}
