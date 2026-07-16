import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { setDbForTesting, resetDbForTesting } from '../db/db.js'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  getState,
  getSettings,
  saveSettings,
  getKnownSenders,
  recordRun,
} from './digestStore.js'

const TEST_USER = 'test-digest-user'

describe('digestStore', () => {
  let store = {
    preferences: new Map(),
    digest_baseline: new Map()
  }

  beforeEach(() => {
    store.preferences.clear()
    store.digest_baseline.clear()
    store.preferences.set(TEST_USER, { user_id: TEST_USER })

    const mockSql = async (strings, ...values) => {
      const queryStr = strings.join('?')
      if (queryStr.includes('FROM preferences') && queryStr.includes('SELECT')) {
        const p = store.preferences.get(1) || store.preferences.get(TEST_USER)
        return p ? [p] : []
      }
      if (queryStr.includes('INSERT INTO preferences') || queryStr.includes('UPDATE preferences')) {
        let existing = store.preferences.get(1) || store.preferences.get(TEST_USER) || { id: 1 }
        // If global VALUES (1, scan_max_messages, default_time_range, label_prefix, digest_enabled, digest_day, digest_hour, digest_recipient)
        if (queryStr.includes('VALUES (1,') || queryStr.includes('WHERE id = 1')) {
          existing.digest_enabled = values[3]
          existing.digest_day = values[4]
          existing.digest_hour = values[5]
          existing.digest_recipient = values[6]
          store.preferences.set(1, existing)
          store.preferences.set(TEST_USER, existing)
        } else {
          const u = values[0]
          existing = store.preferences.get(u) || { user_id: u }
          existing.digest_enabled = values[4]
          existing.digest_day = values[5]
          existing.digest_hour = values[6]
          existing.digest_recipient = values[7]
          store.preferences.set(u, existing)
        }
        return []
      }
      if (queryStr.includes('FROM digest_baseline') && queryStr.includes('SELECT')) {
        const u = values[0] || TEST_USER
        const b = store.digest_baseline.get(u)
        return b ? [b] : []
      }
      if (queryStr.includes('INSERT INTO digest_baseline')) {
        const u = values[0]
        store.digest_baseline.set(u, {
          user_id: u,
          senders: values[1],
          last_run_at: values[2]
        })
        return []
      }
      return []
    }
    setDbForTesting(mockSql)
  })

  afterEach(() => {
    resetDbForTesting()
  })

  it('returns defaults when no settings exist', async () => {
    const s = await getSettings(TEST_USER)
    assert.deepEqual(s, DEFAULT_SETTINGS)
    assert.deepEqual(await getKnownSenders(TEST_USER), [])
  })

  it('normalizeSettings coerces and validates', () => {
    const s = normalizeSettings({ enabled: 1, dayOfWeek: '3', hour: '9', recipient: '  me@x.com ' })
    assert.equal(s.enabled, true)
    assert.equal(s.dayOfWeek, 3)
    assert.equal(s.hour, 9)
    assert.equal(s.recipient, 'me@x.com')
  })

  it('normalizeSettings rejects out-of-range day/hour and bad email', () => {
    assert.throws(() => normalizeSettings({ dayOfWeek: 7 }), /dayOfWeek/)
    assert.throws(() => normalizeSettings({ hour: 24 }), /hour/)
    assert.throws(() => normalizeSettings({ recipient: 'not-an-email' }), /recipient/)
  })

  it('normalizeSettings allows blank recipient (means account address)', () => {
    assert.equal(normalizeSettings({ recipient: '' }).recipient, '')
  })

  it('saveSettings persists and round-trips', async () => {
    await saveSettings(TEST_USER, { enabled: true, dayOfWeek: 5, hour: 7 })
    const s = await getSettings(TEST_USER)
    assert.equal(s.enabled, true)
    assert.equal(s.dayOfWeek, 5)
    assert.equal(s.hour, 7)
  })

  it('recordRun merges senders into baseline (dedup, lowercased) and stamps lastRunAt', async () => {
    await recordRun(TEST_USER, { at: '2026-07-09T08:00:00.000Z', reportedEmails: ['A@x.com', 'b@Y.com'], sent: true, recipient: 'me@x.com' })
    let known = await getKnownSenders(TEST_USER)
    assert.deepEqual(known.sort(), ['a@x.com', 'b@y.com'])

    await recordRun(TEST_USER, { at: '2026-07-16T08:00:00.000Z', reportedEmails: ['a@x.com', 'c@z.com'], sent: true })
    known = await getKnownSenders(TEST_USER)
    assert.deepEqual(known.sort(), ['a@x.com', 'b@y.com', 'c@z.com'])

    const state = await getState(TEST_USER)
    assert.equal(state.lastRunAt, '2026-07-16T08:00:00.000Z')
    assert.equal(state.history.length, 2)
    assert.equal(state.history[0].newSenders, 2)
    assert.equal(state.history[0].at, '2026-07-16T08:00:00.000Z')
  })

  it('recordRun caps history at 20 entries', async () => {
    for (let i = 0; i < 25; i++) {
      await recordRun(TEST_USER, { at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`, reportedEmails: [], sent: false })
    }
    const state = await getState(TEST_USER)
    assert.equal(state.history.length, 20)
  })
})
