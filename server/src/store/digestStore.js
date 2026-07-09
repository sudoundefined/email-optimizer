import fs from 'node:fs/promises'
import { config } from '../config.js'

/**
 * Persistent state for the scheduled weekly digest.
 *
 * Shape:
 * {
 *   settings: { enabled, dayOfWeek (0-6, Sun=0), hour (0-23), recipient (''=account) },
 *   baseline: { knownSenders: string[] (lowercased emails already reported) },
 *   lastRunAt: string|null (ISO),
 *   history: [{ at, newSenders, sent, recipient, error? }]  (most recent first, capped)
 * }
 */

let overridePath = null
export function _setPathForTest(p) { overridePath = p }
function filePath() { return overridePath || config.digestStatePath }

const HISTORY_MAX = 20

export const DEFAULT_SETTINGS = {
  enabled: false,
  dayOfWeek: 1, // Monday
  hour: 8,
  recipient: '', // '' means "the connected account's own address"
}

function emptyState() {
  return { settings: { ...DEFAULT_SETTINGS }, baseline: { knownSenders: [] }, lastRunAt: null, history: [] }
}

async function read() {
  try {
    const raw = JSON.parse(await fs.readFile(filePath(), 'utf8'))
    // merge onto defaults so missing keys are backfilled
    return {
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
      baseline: { knownSenders: raw.baseline?.knownSenders || [] },
      lastRunAt: raw.lastRunAt || null,
      history: Array.isArray(raw.history) ? raw.history : [],
    }
  } catch {
    return emptyState()
  }
}

async function write(state) {
  const dir = filePath().replace(/[/\\][^/\\]+$/, '')
  await fs.mkdir(dir, { recursive: true })
  const tmp = filePath() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
  await fs.rename(tmp, filePath())
}

export async function getState() {
  return read()
}

export async function getSettings() {
  return (await read()).settings
}

/** Validate + normalize a partial settings patch. Throws on bad input. */
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

export async function saveSettings(patch) {
  const state = await read()
  state.settings = normalizeSettings({ ...state.settings, ...patch })
  await write(state)
  return state.settings
}

export async function getKnownSenders() {
  return (await read()).baseline.knownSenders
}

/**
 * Record a completed digest run: merge the reported senders into the baseline,
 * stamp lastRunAt, and prepend a history entry. `at` is passed in (ISO string)
 * so callers control the clock (testability / no Date.now in stores).
 */
export async function recordRun({ at, reportedEmails = [], sent, recipient, error = null }) {
  const state = await read()
  const known = new Set(state.baseline.knownSenders.map((e) => e.toLowerCase()))
  for (const e of reportedEmails) known.add(String(e).toLowerCase())
  state.baseline.knownSenders = [...known]
  state.lastRunAt = at
  state.history = [
    { at, newSenders: reportedEmails.length, sent: Boolean(sent), recipient: recipient || null, error },
    ...state.history,
  ].slice(0, HISTORY_MAX)
  await write(state)
  return state
}
