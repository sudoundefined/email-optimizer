import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  _setPathForTest,
  DEFAULT_SETTINGS,
  normalizeSettings,
  getState,
  getSettings,
  saveSettings,
  getKnownSenders,
  recordRun,
} from './digestStore.js'

const TEST_PATH = path.join(import.meta.dirname, '..', '..', 'data', 'test-digest-state.json')

describe('digestStore', () => {
  before(() => _setPathForTest(TEST_PATH))
  beforeEach(async () => { try { await fs.unlink(TEST_PATH) } catch {} })
  after(async () => { try { await fs.unlink(TEST_PATH) } catch {} })

  it('returns defaults when no file exists', async () => {
    const s = await getSettings()
    assert.deepEqual(s, DEFAULT_SETTINGS)
    assert.deepEqual(await getKnownSenders(), [])
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
    await saveSettings({ enabled: true, dayOfWeek: 5, hour: 7 })
    const s = await getSettings()
    assert.equal(s.enabled, true)
    assert.equal(s.dayOfWeek, 5)
    assert.equal(s.hour, 7)
  })

  it('recordRun merges senders into baseline (dedup, lowercased) and stamps lastRunAt', async () => {
    await recordRun({ at: '2026-07-09T08:00:00.000Z', reportedEmails: ['A@x.com', 'b@Y.com'], sent: true, recipient: 'me@x.com' })
    let known = await getKnownSenders()
    assert.deepEqual(known.sort(), ['a@x.com', 'b@y.com'])

    await recordRun({ at: '2026-07-16T08:00:00.000Z', reportedEmails: ['a@x.com', 'c@z.com'], sent: true })
    known = await getKnownSenders()
    assert.deepEqual(known.sort(), ['a@x.com', 'b@y.com', 'c@z.com'])

    const state = await getState()
    assert.equal(state.lastRunAt, '2026-07-16T08:00:00.000Z')
    assert.equal(state.history.length, 2)
    assert.equal(state.history[0].newSenders, 2) // most recent first
    assert.equal(state.history[0].at, '2026-07-16T08:00:00.000Z')
  })

  it('recordRun caps history at 20 entries', async () => {
    for (let i = 0; i < 25; i++) {
      await recordRun({ at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`, reportedEmails: [], sent: false })
    }
    const state = await getState()
    assert.equal(state.history.length, 20)
  })
})
