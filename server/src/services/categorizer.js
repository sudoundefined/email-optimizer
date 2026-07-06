/**
 * Pure category-suggestion heuristics. Signal priority:
 * domain map > subject keywords > Gmail CATEGORY_* labels > Other.
 */

export const CATEGORIES = [
  'Promotions',
  'Newsletters',
  'Social',
  'Shopping',
  'Finance',
  'Travel',
  'Other',
]

export const DOMAIN_RULES = [
  // [category, exact domains, substring patterns]
  ['Finance', ['paypal.com', 'chase.com', 'wellsfargo.com', 'bankofamerica.com', 'citi.com', 'robinhood.com', 'coinbase.com', 'fidelity.com', 'schwab.com', 'americanexpress.com', 'discover.com', 'capitalone.com', 'venmo.com', 'stripe.com', 'intuit.com', 'creditkarma.com'], ['bank', 'credit', 'invest', 'capital']],
  ['Travel', ['airbnb.com', 'booking.com', 'expedia.com', 'hotels.com', 'kayak.com', 'tripadvisor.com', 'vrbo.com', 'united.com', 'delta.com', 'aa.com', 'southwest.com', 'jetblue.com', 'marriott.com', 'hilton.com', 'hyatt.com', 'uber.com', 'lyft.com'], ['airline', 'hotel', 'travel', 'flight']],
  ['Shopping', ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com', 'bestbuy.com', 'costco.com', 'wayfair.com', 'aliexpress.com', 'shein.com', 'temu.com', 'homedepot.com', 'lowes.com', 'shopify.com'], ['shop', 'store', 'deals']],
  ['Social', ['facebookmail.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'pinterest.com', 'nextdoor.com', 'reddit.com', 'redditmail.com', 'tiktok.com', 'discord.com', 'meetup.com', 'quora.com'], []],
  ['Newsletters', ['substack.com', 'beehiiv.com', 'buttondown.email', 'ghost.io', 'mailchimp.com', 'mcsv.net', 'convertkit.com', 'medium.com'], ['newsletter', 'digest']],
]

export const SUBJECT_RULES = [
  ['Promotions', /%\s*off|\bsale\b|\bdeal\b|\bcoupon\b|\bdiscount\b|\boffer\b|\bsave\b|\bpromo\b/i],
  ['Shopping', /\border\b|\bshipped\b|\bdelivery\b|\breceipt\b|\binvoice\b|\bcart\b|\btracking\b/i],
  ['Finance', /\bstatement\b|\bpayment\b|\bbalance\b|\btransaction\b|\baccount alert\b|\bcredit\b/i],
  ['Travel', /\bitinerary\b|\bflight\b|\bbooking\b|\breservation\b|\bcheck-?in\b|\btrip\b/i],
  ['Newsletters', /\bnewsletter\b|\bdigest\b|\bweekly\b|\bmonthly\b|issue\s*#?\d+|\bedition\b/i],
]

export const GMAIL_CATEGORY_MAP = {
  CATEGORY_PROMOTIONS: 'Promotions',
  CATEGORY_SOCIAL: 'Social',
  CATEGORY_UPDATES: 'Newsletters',
  CATEGORY_FORUMS: 'Newsletters',
}

function matchDomain(domain) {
  const d = String(domain || '').toLowerCase()
  if (!d) return null
  for (const [category, exact, patterns] of DOMAIN_RULES) {
    // match domain or any parent domain (e.g. email.chase.com → chase.com)
    if (exact.some((e) => d === e || d.endsWith('.' + e))) return category
    if (patterns.some((p) => d.includes(p))) return category
  }
  return null
}

function matchSubjects(subjects) {
  const scores = {}
  for (const subject of subjects || []) {
    for (const [category, re] of SUBJECT_RULES) {
      if (re.test(subject)) scores[category] = (scores[category] || 0) + 1
    }
  }
  let best = null
  let bestScore = 0
  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = category
      bestScore = score
    }
  }
  // require the winning keyword to appear in a decent share of subjects
  if (best && bestScore >= Math.max(1, (subjects?.length || 0) * 0.25)) return best
  return null
}

function matchGmailCategory(categoryLabelCounts) {
  let best = null
  let bestCount = 0
  for (const [label, count] of Object.entries(categoryLabelCounts || {})) {
    if (GMAIL_CATEGORY_MAP[label] && count > bestCount) {
      best = GMAIL_CATEGORY_MAP[label]
      bestCount = count
    }
  }
  return best
}

/**
 * suggestCategory(sender) → {category, confidence: 'high'|'medium'|'low', reason}
 * sender: {domain, subjects[], categoryLabelCounts{}}
 */
export function suggestCategory(sender) {
  const byDomain = matchDomain(sender.domain)
  if (byDomain) return { category: byDomain, confidence: 'high', reason: `domain ${sender.domain}` }

  const bySubject = matchSubjects(sender.subjects)
  if (bySubject) return { category: bySubject, confidence: 'medium', reason: 'subject keywords' }

  const byGmail = matchGmailCategory(sender.categoryLabelCounts)
  if (byGmail) return { category: byGmail, confidence: 'medium', reason: 'Gmail category' }

  return { category: 'Other', confidence: 'low', reason: 'no signals' }
}
