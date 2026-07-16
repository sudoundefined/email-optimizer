import { ProtectedSenderRepository } from '../models/ProtectedSenderRepository.js'

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

export async function listProtected(userId) {
  const rows = await ProtectedSenderRepository.findByUserId(userId)
  return rows.map(r => ({
    email: r.email,
    domain: r.domain,
    reason: r.source,
    addedAt: r.added_at
  }))
}

export async function protectSenders(userId, emails) {
  await ProtectedSenderRepository.insertMany(userId, emails, 'manual')
  return listProtected(userId)
}

export async function unprotectSenders(userId, emails) {
  await ProtectedSenderRepository.deleteMany(userId, emails)
  return listProtected(userId)
}

export async function isProtected(userId, email) {
  return ProtectedSenderRepository.isProtected(userId, email)
}

export async function runAutoProtect(userId, senders) {
  const detected = autoProtectFromScan(senders)
  if (detected.length === 0) return []

  const currentRows = await ProtectedSenderRepository.findByUserId(userId)
  const existingSet = new Set(currentRows.map(r => r.email.toLowerCase()))

  const added = []
  for (const d of detected) {
    if (!existingSet.has(d.email.toLowerCase())) {
      await ProtectedSenderRepository.insertMany(userId, [d.email], d.reason)
      added.push(d)
    }
  }
  return added
}

export async function filterProtected(userId, senderEmails) {
  const list = await listProtected(userId)
  const protectedSet = new Set(list.map(p => p.email.toLowerCase()))
  const allowed = []
  const excluded = []
  for (const email of senderEmails) {
    if (protectedSet.has(email.toLowerCase())) excluded.push(email)
    else allowed.push(email)
  }
  return { allowed, excluded }
}
