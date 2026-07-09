import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mostRecentSlot, isDigestDue } from './scheduler.js'

// A known Monday: 2026-07-06 is a Monday. Build local-time dates for clarity.
function at(y, mo, d, h, mi = 0) {
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime()
}

describe('scheduler mostRecentSlot', () => {
  it('returns the same day at the given hour when now is later that day', () => {
    // Monday 2026-07-06 14:00, slot Monday(1) 08:00 -> same day 08:00
    const slot = mostRecentSlot(at(2026, 7, 6, 14), 1, 8)
    assert.equal(slot, at(2026, 7, 6, 8))
  })

  it('rolls back to previous week when the slot has not occurred yet', () => {
    // Monday 2026-07-06 06:00 (before 08:00) -> previous Monday 2026-06-29 08:00
    const slot = mostRecentSlot(at(2026, 7, 6, 6), 1, 8)
    assert.equal(slot, at(2026, 6, 29, 8))
  })

  it('finds the most recent matching weekday', () => {
    // Wednesday 2026-07-08 10:00, slot Monday(1) 08:00 -> Monday 2026-07-06 08:00
    const slot = mostRecentSlot(at(2026, 7, 8, 10), 1, 8)
    assert.equal(slot, at(2026, 7, 6, 8))
  })

  it('does not drift the hour across a week shift (DST-safe re-normalization)', () => {
    // Whatever the hour, the returned slot must land exactly on that wall-clock
    // hour, never an hour off from a date-shift normalization artifact.
    for (const h of [0, 2, 8, 23]) {
      const slot = new Date(mostRecentSlot(at(2026, 7, 6, 6), 1, h))
      // now is Monday 06:00; for h>6 the slot rolls to the previous Monday
      assert.equal(slot.getHours(), h, `hour ${h} must be preserved`)
      assert.equal(slot.getDay(), 1, 'must land on Monday')
    }
  })
})

describe('scheduler isDigestDue', () => {
  const settings = { enabled: true, dayOfWeek: 1, hour: 8 }

  it('is false when disabled', () => {
    assert.equal(isDigestDue(at(2026, 7, 8, 10), { ...settings, enabled: false }, null), false)
  })

  it('is true when never run and enabled', () => {
    assert.equal(isDigestDue(at(2026, 7, 8, 10), settings, null), true)
  })

  it('is true when last run predates the most recent slot', () => {
    // now Wed 07-08 10:00; slot = Mon 07-06 08:00; last run last week
    assert.equal(isDigestDue(at(2026, 7, 8, 10), settings, new Date(at(2026, 6, 30, 8)).toISOString()), true)
  })

  it('is false when already run after the most recent slot', () => {
    // last run Mon 07-06 08:05, now Wed 07-08 -> not due again until next Monday
    assert.equal(isDigestDue(at(2026, 7, 8, 10), settings, new Date(at(2026, 7, 6, 8, 5)).toISOString()), false)
  })
})
