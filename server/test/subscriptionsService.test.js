import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectSubscriptions, matchVendor, estimateCadence } from '../src/services/subscriptionsService.js'

const DAY = 24 * 60 * 60 * 1000

test('matchVendor: domain match (exact + parent)', () => {
  assert.equal(matchVendor({ domain: 'netflix.com' }), 'Netflix')
  assert.equal(matchVendor({ domain: 'billing.spotify.com' }), 'Spotify')
  assert.equal(matchVendor({ domain: 'randomshop.io' }), null)
})

test('matchVendor: display-name fallback for broad platforms', () => {
  // amazon.com is intentionally NOT a vendor domain (too much non-sub mail),
  // so Prime is detected by name only.
  assert.equal(matchVendor({ domain: 'amazon.com', name: 'Amazon Prime' }), 'Amazon Prime')
  assert.equal(matchVendor({ domain: 'google.com', name: 'Google One' }), 'Google One / Workspace')
  // A plain amazon shopping receipt should NOT match a subscription.
  assert.equal(matchVendor({ domain: 'amazon.com', name: 'Amazon.com' }), null)
})

test('estimateCadence: monthly vs annual vs unknown', () => {
  assert.equal(estimateCadence({ messageCount: 1, firstDate: 0, latestDate: 0 }), 'unknown')
  const now = 1_700_000_000_000
  // 12 messages one month apart → monthly
  assert.equal(
    estimateCadence({ messageCount: 12, firstDate: now - 330 * DAY, latestDate: now }),
    'monthly'
  )
  // 3 messages one year apart → annual
  assert.equal(
    estimateCadence({ messageCount: 3, firstDate: now - 730 * DAY, latestDate: now }),
    'annual'
  )
  // weekly newsletter cadence
  assert.equal(
    estimateCadence({ messageCount: 20, firstDate: now - 133 * DAY, latestDate: now }),
    'weekly'
  )
})

test('detectSubscriptions: filters to matched vendors, sorted by recency', () => {
  const now = 1_700_000_000_000
  const senders = new Map([
    ['a@netflix.com', { email: 'a@netflix.com', name: 'Netflix', domain: 'netflix.com', messageCount: 12, firstDate: now - 330 * DAY, latestDate: now - DAY, unsubscribe: { method: 'oneclick' } }],
    ['b@spotify.com', { email: 'b@spotify.com', name: 'Spotify', domain: 'spotify.com', messageCount: 6, firstDate: now - 150 * DAY, latestDate: now, unsubscribe: { method: 'link' } }],
    ['c@randomshop.io', { email: 'c@randomshop.io', name: 'Shop', domain: 'randomshop.io', messageCount: 3, firstDate: now - 30 * DAY, latestDate: now, unsubscribe: { method: 'none' } }],
  ])
  const subs = detectSubscriptions(senders)
  assert.equal(subs.length, 2)
  assert.equal(subs[0].vendor, 'Spotify') // most recent lastSeen first
  assert.equal(subs[1].vendor, 'Netflix')
  assert.equal(subs[0].cadence, 'monthly')
  assert.equal(subs[0].method, 'link')
})

test('detectSubscriptions: accepts a plain array too', () => {
  const subs = detectSubscriptions([{ email: 'x@adobe.com', domain: 'adobe.com', messageCount: 2, firstDate: 1, latestDate: 2 }])
  assert.equal(subs.length, 1)
  assert.equal(subs[0].vendor, 'Adobe')
})
