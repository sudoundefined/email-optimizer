/**
 * Pure category-suggestion heuristics. Signal priority:
 * domain map > subject keywords > Gmail CATEGORY_* labels > Other.
 */

export const CATEGORIES = [
  'Work',
  'Banking',
  'Shopping',
  'Travel',
  'Medical',
  'Tax',
  'Bills',
  'Subscriptions',
  'Newsletters',
  'Social',
  'Promotions',
  'Personal',
  'Other',
]

/**
 * Recurring paid services. Shared single source of truth: the categorizer uses
 * the `domains` to tag senders as `Subscriptions`, and subscriptionsService uses
 * domains + namePatterns + cadence to detect subscriptions from a scan.
 *
 * `domains` are safe to hard-match (narrow, subscription-only). Broad platforms
 * (google/apple/microsoft/amazon) are intentionally matched by namePatterns only
 * — their bare domains send far more non-subscription mail than subscription mail.
 */
export const RECURRING_VENDORS = [
  { vendor: 'Netflix',          domains: ['netflix.com'],                 namePatterns: ['netflix'] },
  { vendor: 'Spotify',          domains: ['spotify.com'],                 namePatterns: ['spotify'] },
  { vendor: 'Amazon Prime',     domains: [],                             namePatterns: ['amazon prime', 'prime video', 'prime membership'] },
  { vendor: 'YouTube Premium',  domains: [],                             namePatterns: ['youtube premium', 'youtube music'] },
  { vendor: 'OpenAI / ChatGPT', domains: ['openai.com'],                  namePatterns: ['openai', 'chatgpt'] },
  { vendor: 'Anthropic / Claude', domains: ['anthropic.com'],            namePatterns: ['anthropic', 'claude'] },
  { vendor: 'Adobe',            domains: ['adobe.com'],                   namePatterns: ['adobe'] },
  { vendor: 'Canva',            domains: ['canva.com'],                   namePatterns: ['canva'] },
  { vendor: 'GitHub',           domains: ['github.com'],                  namePatterns: ['github'] },
  { vendor: 'Notion',           domains: ['notion.so', 'notion.com'],     namePatterns: ['notion'] },
  { vendor: 'Dropbox',          domains: ['dropbox.com'],                 namePatterns: ['dropbox'] },
  { vendor: 'Figma',            domains: ['figma.com'],                   namePatterns: ['figma'] },
  { vendor: 'Slack',            domains: ['slack.com'],                   namePatterns: ['slack'] },
  { vendor: 'Disney+',          domains: ['disneyplus.com'],              namePatterns: ['disney+', 'disney plus'] },
  { vendor: 'Hulu',             domains: ['hulu.com'],                    namePatterns: ['hulu'] },
  { vendor: 'HBO Max',          domains: ['max.com', 'hbomax.com'],       namePatterns: ['hbo max'] },
  { vendor: 'Squarespace',      domains: ['squarespace.com'],             namePatterns: ['squarespace'] },
  { vendor: 'Domain renewal',   domains: ['godaddy.com', 'namecheap.com'], namePatterns: ['domain renewal', 'godaddy', 'namecheap'] },
  { vendor: 'Google One / Workspace', domains: [],                        namePatterns: ['google one', 'google workspace', 'google storage'] },
  { vendor: 'iCloud+',          domains: [],                             namePatterns: ['icloud'] },
  { vendor: 'Microsoft 365',    domains: [],                             namePatterns: ['microsoft 365', 'office 365'] },
  { vendor: 'LinkedIn Premium', domains: [],                             namePatterns: ['linkedin premium'] },
]

const SUBSCRIPTION_DOMAINS = [...new Set(RECURRING_VENDORS.flatMap((v) => v.domains))]

export const DOMAIN_RULES = [
  // [category, exact domains, substring patterns] — first match wins.
  ['Tax', ['irs.gov', 'intuit.com', 'turbotax.com', 'hrblock.com'], ['turbotax']],
  ['Banking', ['paypal.com', 'chase.com', 'wellsfargo.com', 'bankofamerica.com', 'citi.com', 'robinhood.com', 'coinbase.com', 'fidelity.com', 'schwab.com', 'vanguard.com', 'etrade.com', 'americanexpress.com', 'discover.com', 'capitalone.com', 'venmo.com', 'zelle.com', 'stripe.com', 'creditkarma.com', 'ally.com', 'sofi.com'], ['bank', 'creditunion']],
  ['Subscriptions', SUBSCRIPTION_DOMAINS, []],
  ['Travel', ['airbnb.com', 'booking.com', 'expedia.com', 'hotels.com', 'kayak.com', 'tripadvisor.com', 'vrbo.com', 'united.com', 'delta.com', 'aa.com', 'southwest.com', 'jetblue.com', 'marriott.com', 'hilton.com', 'hyatt.com', 'uber.com', 'lyft.com'], ['airline', 'hotel', 'travel', 'flight']],
  ['Shopping', ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com', 'bestbuy.com', 'costco.com', 'wayfair.com', 'aliexpress.com', 'shein.com', 'temu.com', 'homedepot.com', 'lowes.com', 'shopify.com'], ['shop', 'store', 'deals']],
  ['Bills', ['pge.com', 'sce.com', 'att.com', 'verizon.com', 'tmobile.com', 'xfinity.com', 'comcast.com', 'spectrum.com', 'coned.com', 'duke-energy.com'], ['utilit', 'electric', 'wireless']],
  ['Medical', ['kaiserpermanente.org', 'unitedhealthcare.com', 'cigna.com', 'aetna.com', 'anthem.com', 'cvs.com', 'walgreens.com', 'mychart.com', 'labcorp.com', 'questdiagnostics.com'], ['health', 'clinic', 'pharmacy', 'medical', 'dental']],
  ['Work', ['linkedin.com', 'greenhouse.io', 'lever.co', 'workday.com', 'myworkday.com', 'indeed.com', 'glassdoor.com', 'ashbyhq.com'], ['recruit']],
  ['Social', ['facebookmail.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'pinterest.com', 'nextdoor.com', 'reddit.com', 'redditmail.com', 'tiktok.com', 'discord.com', 'meetup.com', 'quora.com'], []],
  ['Newsletters', ['substack.com', 'beehiiv.com', 'buttondown.email', 'ghost.io', 'mailchimp.com', 'mcsv.net', 'convertkit.com', 'medium.com'], ['newsletter', 'digest']],
]

export const SUBJECT_RULES = [
  ['Tax', /\btax\b|\bw-?2\b|\b1099\b|\birs\b|tax return|tax document|tax form/i],
  ['Banking', /\bstatement\b|\bbalance\b|\btransaction\b|account alert|direct deposit|\bwithdrawal\b|wire transfer/i],
  ['Bills', /payment due|past due|autopay|amount due|your bill|billing statement|\butility\b/i],
  ['Medical', /\bappointment\b|\bprescription\b|\brefill\b|lab result|test result|explanation of benefits|\beob\b|\bcopay\b|patient portal/i],
  ['Subscriptions', /\bsubscription\b|\brenewal\b|\brenews\b|auto-?renew|your plan|membership (?:renew|confirm)|payment received for/i],
  ['Work', /offer letter|\binterview\b|recruiter|job application|\bhiring\b|performance review|\b1:1\b|\bstandup\b|onboarding|promotion/i],
  ['Promotions', /%\s*off|\bsale\b|\bdeal\b|\bcoupon\b|\bdiscount\b|\boffer\b|\bsave\b|\bpromo\b/i],
  ['Shopping', /\border\b|\bshipped\b|\bdelivery\b|\breceipt\b|\bcart\b|\btracking\b/i],
  ['Travel', /\bitinerary\b|\bflight\b|\bbooking\b|\breservation\b|\bcheck-?in\b|\btrip\b/i],
  ['Newsletters', /\bnewsletter\b|\bdigest\b|\bweekly\b|\bmonthly\b|issue\s*#?\d+|\bedition\b/i],
]

export const GMAIL_CATEGORY_MAP = {
  CATEGORY_PROMOTIONS: 'Promotions',
  CATEGORY_SOCIAL: 'Social',
  CATEGORY_UPDATES: 'Newsletters',
  CATEGORY_FORUMS: 'Newsletters',
  CATEGORY_PERSONAL: 'Personal',
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
