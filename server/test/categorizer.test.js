import { test } from 'node:test'
import assert from 'node:assert/strict'
import { suggestCategory, RECURRING_VENDORS, CATEGORIES } from '../src/services/categorizer.js'

const sender = (overrides) => ({
  domain: '',
  subjects: [],
  categoryLabelCounts: {},
  ...overrides,
})

test('domain match wins with high confidence', () => {
  const r = suggestCategory(sender({ domain: 'chase.com' }))
  assert.equal(r.category, 'Banking')
  assert.equal(r.confidence, 'high')
})

test('subdomain of a known domain matches', () => {
  const r = suggestCategory(sender({ domain: 'email.chase.com' }))
  assert.equal(r.category, 'Banking')
})

test('domain beats Gmail category and subjects', () => {
  const r = suggestCategory(
    sender({
      domain: 'linkedin.com',
      subjects: ['50% off sale today'],
      categoryLabelCounts: { CATEGORY_PROMOTIONS: 10 },
    })
  )
  assert.equal(r.category, 'Work') // linkedin.com is a Work domain now
})

test('subject keywords used when domain unknown', () => {
  const r = suggestCategory(
    sender({
      domain: 'unknown-store-xyz.io',
      subjects: ['Your order has shipped', 'Order confirmation', 'Delivery update'],
    })
  )
  assert.equal(r.category, 'Shopping')
})

test('Gmail category fallback', () => {
  const r = suggestCategory(
    sender({ domain: 'randomsite.xyz', categoryLabelCounts: { CATEGORY_SOCIAL: 5 } })
  )
  assert.equal(r.category, 'Social')
})

test('CATEGORY_PERSONAL maps to Personal', () => {
  const r = suggestCategory(
    sender({ domain: 'randomsite.xyz', categoryLabelCounts: { CATEGORY_PERSONAL: 3 } })
  )
  assert.equal(r.category, 'Personal')
})

test('no signals → Other with low confidence', () => {
  const r = suggestCategory(sender({ domain: 'randomsite.xyz' }))
  assert.equal(r.category, 'Other')
  assert.equal(r.confidence, 'low')
})

test('newsletter platform domains → Newsletters', () => {
  assert.equal(suggestCategory(sender({ domain: 'substack.com' })).category, 'Newsletters')
  assert.equal(suggestCategory(sender({ domain: 'mail.beehiiv.com' })).category, 'Newsletters')
})

// ── New taxonomy categories ──────────────────────────────────────────────────

test('tax domains and subjects → Tax', () => {
  assert.equal(suggestCategory(sender({ domain: 'irs.gov' })).category, 'Tax')
  assert.equal(
    suggestCategory(sender({ domain: 'x.io', subjects: ['Your 1099 is ready', 'Tax document available'] })).category,
    'Tax'
  )
})

test('subscription vendor domain → Subscriptions', () => {
  assert.equal(suggestCategory(sender({ domain: 'netflix.com' })).category, 'Subscriptions')
  assert.equal(suggestCategory(sender({ domain: 'billing.spotify.com' })).category, 'Subscriptions')
})

test('utility/telecom domains → Bills', () => {
  assert.equal(suggestCategory(sender({ domain: 'pge.com' })).category, 'Bills')
  assert.equal(suggestCategory(sender({ domain: 'xfinity.com' })).category, 'Bills')
})

test('medical domains and subjects → Medical', () => {
  assert.equal(suggestCategory(sender({ domain: 'mychart.com' })).category, 'Medical')
  assert.equal(
    suggestCategory(sender({ domain: 'clinic-xyz.org', subjects: ['Appointment reminder', 'Your lab result is ready', 'Prescription refill'] })).category,
    'Medical'
  )
})

test('work subjects → Work when domain unknown', () => {
  const r = suggestCategory(
    sender({ domain: 'startup-xyz.io', subjects: ['Interview invitation', 'Offer letter attached', 'Recruiter follow-up'] })
  )
  assert.equal(r.category, 'Work')
})

test('bills subjects → Bills', () => {
  const r = suggestCategory(
    sender({ domain: 'svc-xyz.io', subjects: ['Your bill is ready', 'Payment due soon', 'Autopay scheduled'] })
  )
  assert.equal(r.category, 'Bills')
})

test('RECURRING_VENDORS is well-formed and every domain is subscription-tagged', () => {
  for (const v of RECURRING_VENDORS) {
    assert.ok(typeof v.vendor === 'string' && v.vendor.length > 0)
    assert.ok(Array.isArray(v.domains) && Array.isArray(v.namePatterns))
    for (const d of v.domains) {
      assert.equal(suggestCategory(sender({ domain: d })).category, 'Subscriptions', `${d} should be Subscriptions`)
    }
  }
})

test('CATEGORIES includes all requested organizational labels', () => {
  for (const c of ['Work', 'Banking', 'Shopping', 'Travel', 'Medical', 'Tax', 'Bills', 'Subscriptions', 'Newsletters', 'Personal']) {
    assert.ok(CATEGORIES.includes(c), `CATEGORIES should include ${c}`)
  }
})
