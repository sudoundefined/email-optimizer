import { describe, it, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getDb } from './../db/db.js'
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
  before(() => {
    const db = getDb()
    db.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)').run(TEST_USER, 'test@x.com')
  })

  beforeEach(() => {
    const db = getDb()
    db.prepare('DELETE FROM preferences WHERE user_id = ?').run(TEST_USER)
    db.prepare('DELETE FROM digest_baseline WHERE user_id = ?').run(TEST_USER)
    db.prepare('INSERT INTO preferences (user_id) VALUES (?)').run(TEST_USER)
  })

  it('returns defaults when no settings exist', () => {
    const s = getSettings(TEST_USER)
    assert.deepEqual(s, DEFAULT_SETTINGS)
    assert.deepEqual(getKnownSenders(TEST_USER), [])
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

  it('saveSettings persists and round-trips', () => {
    saveSettings(TEST_USER, { enabled: true, dayOfWeek: 5, hour: 7 })
    const s = getSettings(TEST_USER)
    assert.equal(s.enabled, true)
    assert.equal(s.dayOfWeek, 5)
    assert.equal(s.hour, 7)
  })

  it('recordRun merges senders into baseline (dedup, lowercased) and stamps lastRunAt', () => {
    recordRun(TEST_USER, { at: '2026-07-09T08:00:00.000Z', reportedEmails: ['A@x.com', 'b@Y.com'], sent: true, recipient: 'me@x.com' })
    let known = getKnownSenders(TEST_USER)
    assert.deepEqual(known.sort(), ['a@x.com', 'b@y.com'])

    recordRun(TEST_USER, { at: '2026-07-16T08:00:00.000Z', reportedEmails: ['a@x.com', 'c@z.com'], sent: true })
    known = getKnownSenders(TEST_USER)
    assert.deepEqual(known.sort(), ['a@x.com', 'b@y.com', 'c@z.com'])

    const state = getState(TEST_USER)
    assert.equal(state.lastRunAt, '2026-07-16T08:00:00.000Z')
    assert.equal(state.history.length, 2)
    assert.equal(state.history[0].newSenders, 2)
    assert.equal(state.history[0].at, '2026-07-16T08:00:00.000Z')
  })

  it('recordRun caps history at 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      recordRun(TEST_USER, { at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`, reportedEmails: [], sent: false })
    }
    const state = getState(TEST_USER)
    assert.equal(state.history.length, 20)
  })
})
