import { PreferenceRepository } from '../models/PreferenceRepository.js'
import { DigestBaselineRepository } from '../models/DigestBaselineRepository.js'
import { LIST_LIMITS } from '../utils/constants.js'

const HISTORY_MAX = LIST_LIMITS.DIGEST_HISTORY_MAX
const historyCache = new Map()

export const DEFAULT_SETTINGS = {
  enabled: false,
  dayOfWeek: 1, // Monday
  hour: 9,
  recipient: '',
}

export async function getSettings(userId) {
  const row = await PreferenceRepository.findByUserId(userId)
  return {
    enabled: Boolean(row?.digest_enabled),
    dayOfWeek: row?.digest_day ?? DEFAULT_SETTINGS.dayOfWeek,
    hour: row?.digest_hour ?? DEFAULT_SETTINGS.hour,
    recipient: row?.digest_recipient || '',
  }
}

export async function getBaseline(userId) {
  const row = await DigestBaselineRepository.findByUserId(userId)
  if (!row || !row.senders) return { knownSenders: [] }
  try {
    return { knownSenders: JSON.parse(row.senders) }
  } catch {
    return { knownSenders: [] }
  }
}

export async function getLastRunAt(userId) {
  const row = await DigestBaselineRepository.findByUserId(userId)
  return row?.last_run_at || null
}

export function getHistory(userId) {
  return historyCache.get(userId) || []
}

export async function getState(userId) {
  const settings = await getSettings(userId)
  const baseline = await getBaseline(userId)
  const lastRunAt = await getLastRunAt(userId)
  const history = getHistory(userId)
  return { settings, baseline, lastRunAt, history }
}

export function normalizeSettings(patch) {
  const s = { ...DEFAULT_SETTINGS, ...(patch || {}) }
  const enabled = Boolean(s.enabled)
  const dayOfWeek = Number(s.dayOfWeek)
  const hour = Number(s.hour)
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    const err = new Error('dayOfWeek must be an integer 0-6 (Sunday=0)')
    err.status = 400
    throw err
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    const err = new Error('hour must be an integer 0-23')
    err.status = 400
    throw err
  }
  const recipient = typeof s.recipient === 'string' ? s.recipient.trim() : ''
  if (recipient && !/^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+$/.test(recipient)) {
    const err = new Error('recipient must be a valid email address or blank')
    err.status = 400
    throw err
  }
  return { enabled, dayOfWeek, hour, recipient }
}

export async function saveSettings(userId, patch) {
  const current = await getSettings(userId)
  const merged = normalizeSettings({ ...current, ...patch })

  await PreferenceRepository.update(userId, {
    digest_enabled: merged.enabled ? 1 : 0,
    digest_day: merged.dayOfWeek,
    digest_hour: merged.hour,
    digest_recipient: merged.recipient
  })

  return merged
}

export async function getKnownSenders(userId) {
  const b = await getBaseline(userId)
  return b.knownSenders
}

export async function recordRun(userId, { at, reportedEmails = [], sent, recipient, error = null }) {
  const current = await getBaseline(userId)
  const known = new Set(current.knownSenders.map((e) => e.toLowerCase()))
  for (const e of reportedEmails) known.add(String(e).toLowerCase())

  await DigestBaselineRepository.upsert(userId, [...known], at)

  const history = getHistory(userId)
  const updated = [
    { at, newSenders: reportedEmails.length, sent: Boolean(sent), recipient: recipient || null, error },
    ...history,
  ].slice(0, HISTORY_MAX)
  historyCache.set(userId, updated)

  return getState(userId)
}
