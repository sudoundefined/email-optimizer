import { createJob, isJobRunning } from './jobManager.js'
import { getState } from '../store/digestStore.js'
import { runDigest } from '../services/digestRunner.js'
import { getDb } from '../db/db.js'

const CHECK_INTERVAL_MS = 15 * 60 * 1000 // re-evaluate every 15 minutes
const INITIAL_DELAY_MS = 10 * 1000 // first check shortly after boot

/**
 * The most recent weekly slot (dayOfWeek 0-6 Sun=0, hour 0-23) at or before
 * `now` (ms). Pure — used to decide whether a run is due.
 */
export function mostRecentSlot(now, dayOfWeek, hour) {
  const d = new Date(now)
  d.setHours(hour, 0, 0, 0)
  const diff = (d.getDay() - dayOfWeek + 7) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(hour, 0, 0, 0) // re-normalize after the date shift (DST-safe)
  if (d.getTime() > now) {
    d.setDate(d.getDate() - 7)
    d.setHours(hour, 0, 0, 0)
  }
  return d.getTime()
}

/**
 * Whether a digest run is due. Pure. Enabled + (never run OR last run was
 * before the most recent scheduled slot). Catch-up semantics: if the process
 * was down at the scheduled time, it runs on the next tick after coming up.
 */
export function isDigestDue(now, settings, lastRunAt) {
  if (!settings?.enabled) return false
  const slot = mostRecentSlot(now, settings.dayOfWeek, settings.hour)
  if (!lastRunAt) return true
  return new Date(lastRunAt).getTime() < slot
}

async function tick() {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT user_id FROM preferences WHERE digest_enabled = 1').all()
    for (const { user_id: userId } of rows) {
      const state = getState(userId)
      if (isJobRunning(userId, 'digest')) continue
      if (!isDigestDue(Date.now(), state.settings, state.lastRunAt)) continue
      createJob(userId, 'digest', (emit) => runDigest(userId, { range: '6m' }, emit))
      console.log(`[scheduler] weekly digest run started for user ${userId}`)
    }
  } catch (err) {
    console.error('[scheduler] tick failed:', err?.message || err)
  }
}

/** Start the in-process weekly-digest scheduler. Returns a stop() function. */
export function startScheduler() {
  const interval = setInterval(tick, CHECK_INTERVAL_MS)
  const initial = setTimeout(tick, INITIAL_DELAY_MS)
  return () => {
    clearInterval(interval)
    clearTimeout(initial)
  }
}
