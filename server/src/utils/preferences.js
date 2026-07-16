import { PreferenceRepository } from '../models/PreferenceRepository.js'
import { SCAN_DEFAULTS } from './constants.js'

/**
 * Fetch effective scan limits from the DB preferences table scoped to a specific user.
 * Resolves scan_max_messages, default_time_range, and label_prefix from the database,
 * falling back cleanly to SCAN_DEFAULTS if unset or invalid.
 */
export async function getEffectiveScanLimits(userId, sql) {
  if (typeof userId === 'function' || typeof userId === 'object') {
    // Legacy call without userId
    sql = userId
    userId = null
  }
  try {
    const prefs = await PreferenceRepository.get(userId, sql)
    const maxMessages = prefs && prefs.scan_max_messages !== null && prefs.scan_max_messages !== undefined && Number.isFinite(Number(prefs.scan_max_messages)) && Number(prefs.scan_max_messages) > 0
      ? Number(prefs.scan_max_messages)
      : SCAN_DEFAULTS.MAX_MESSAGES
    const timeRange = prefs?.default_time_range || SCAN_DEFAULTS.TIME_RANGE
    const labelPrefix = prefs?.label_prefix || SCAN_DEFAULTS.LABEL_PREFIX

    return {
      maxMessages,
      timeRange,
      labelPrefix,
    }
  } catch (err) {
    return {
      maxMessages: SCAN_DEFAULTS.MAX_MESSAGES,
      timeRange: SCAN_DEFAULTS.TIME_RANGE,
      labelPrefix: SCAN_DEFAULTS.LABEL_PREFIX,
    }
  }
}
