import { test } from 'node:test'
import assert from 'node:assert/strict'
import { suggestCategory } from '../src/services/categorizer.js'

const sender = (overrides) => ({
  domain: '',
  subjects: [],
  categoryLabelCounts: {},
  ...overrides,
})

test('domain match wins with high confidence', () => {
  const r = suggestCategory(sender({ domain: 'chase.com' }))
  assert.equal(r.category, 'Finance')
  assert.equal(r.confidence, 'high')
})

test('subdomain of a known domain matches', () => {
  const r = suggestCategory(sender({ domain: 'email.chase.com' }))
  assert.equal(r.category, 'Finance')
})

test('domain beats Gmail category and subjects', () => {
  const r = suggestCategory(
    sender({
      domain: 'linkedin.com',
      subjects: ['50% off sale today'],
      categoryLabelCounts: { CATEGORY_PROMOTIONS: 10 },
    })
  )
  assert.equal(r.category, 'Social')
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

test('no signals → Other with low confidence', () => {
  const r = suggestCategory(sender({ domain: 'randomsite.xyz' }))
  assert.equal(r.category, 'Other')
  assert.equal(r.confidence, 'low')
})

test('newsletter platform domains → Newsletters', () => {
  assert.equal(suggestCategory(sender({ domain: 'substack.com' })).category, 'Newsletters')
  assert.equal(suggestCategory(sender({ domain: 'mail.beehiiv.com' })).category, 'Newsletters')
})
