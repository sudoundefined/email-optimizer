import { createJob, isJobRunning } from './jobManager.js'
import { getState } from '../store/digestStore.js'
import { runDigest } from '../services/digestRunner.js'
import { UserRepository } from '../models/UserRepository.js'

const CHECK_INTERVAL_MS = 15 * 60 * 1000 // re-evaluate every 15 minutes
const INITIAL_DELAY_MS = 10 * 1000 // first check shortly after boot

export function mostRecentSlot(now, dayOfWeek, hour) {
  const d = new Date(now)
  d.setHours(hour, 0, 0, 0)
  const diff = (d.getDay() - dayOfWeek + 7) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(hour, 0, 0, 0)
  if (d.getTime() > now) {
    d.setDate(d.getDate() - 7)
    d.setHours(hour, 0, 0, 0)
  }
  return d.getTime()
}

export function isDigestDue(now, settings, lastRunAt) {
  if (!settings?.enabled) return false
  const slot = mostRecentSlot(now, settings.dayOfWeek, settings.hour)
  if (!lastRunAt) return true
  return new Date(lastRunAt).getTime() < slot
}

async function tick() {
  try {
    const users = await UserRepository.findAll()
    for (const user of users) {
      const userId = user.id
      const state = await getState(userId)
      if (!state.settings.enabled) continue
      if (isJobRunning(userId, 'digest')) continue
      if (!isDigestDue(Date.now(), state.settings, state.lastRunAt)) continue
      createJob(userId, 'digest', (emit) => runDigest(userId, { range: '6m' }, emit))
      console.log(`[scheduler] weekly digest run started for user workspace ${userId}`)
    }
  } catch (err) {
    console.error('[scheduler] tick failed:', err?.message || err)
  }
}

export function startScheduler() {
  const interval = setInterval(tick, CHECK_INTERVAL_MS)
  const initial = setTimeout(tick, INITIAL_DELAY_MS)
  return () => {
    clearInterval(interval)
    clearTimeout(initial)
  }
}
