import { getDb } from '../db/db.js'
import { SCAN_DEFAULTS } from '../utils/constants.js'

export const PreferenceRepository = {
  /**
   * Get preferences for a specific user.
   * Scoped strictly by user_id under the 1:1 user/account architecture.
   */
  async get(userId, sql = getDb()) {
    if (typeof userId === 'function' || typeof userId === 'object' || !userId) {
      if (typeof userId === 'function') sql = userId
      return {
        scan_max_messages: SCAN_DEFAULTS.MAX_MESSAGES,
        default_time_range: SCAN_DEFAULTS.TIME_RANGE,
        label_prefix: SCAN_DEFAULTS.LABEL_PREFIX,
        digest_enabled: 0,
        digest_day: 1,
        digest_hour: 9,
        digest_recipient: '',
        onboarding_step: 'welcome',
        has_completed_onboarding: false,
        protected_categories: [],
      }
    }

    const [row] = await sql`
      SELECT scan_max_messages, default_time_range, label_prefix, digest_enabled, digest_day, digest_hour, digest_recipient, onboarding_step, has_completed_onboarding, protected_categories
      FROM preferences
      WHERE user_id = ${String(userId)}
      LIMIT 1
    `
    if (!row) {
      return {
        scan_max_messages: SCAN_DEFAULTS.MAX_MESSAGES,
        default_time_range: SCAN_DEFAULTS.TIME_RANGE,
        label_prefix: SCAN_DEFAULTS.LABEL_PREFIX,
        digest_enabled: 0,
        digest_day: 1,
        digest_hour: 9,
        digest_recipient: '',
        onboarding_step: 'welcome',
        has_completed_onboarding: false,
        protected_categories: [],
      }
    }
    return {
      ...row,
      onboarding_step: row.onboarding_step || 'welcome',
      has_completed_onboarding: Boolean(row.has_completed_onboarding),
      protected_categories: Array.isArray(row.protected_categories) ? row.protected_categories : [],
    }
  },

  /**
   * Alias for get(userId, sql) during transition.
   */
  async findByUserId(userId, sql = getDb()) {
    return this.get(userId, sql)
  },

  /**
   * Ensure default preference row exists for a specific user.
   */
  async upsertDefault(userId, sql = getDb()) {
    if (!userId || typeof userId === 'function' || typeof userId === 'object') return
    await sql`
      INSERT INTO preferences (user_id)
      VALUES (${String(userId)})
      ON CONFLICT(user_id) DO NOTHING
    `
  },

  /**
   * Update preferences for a specific user.
   */
  async update(userId, updates, sql = getDb()) {
    if (typeof userId === 'object' && userId !== null) {
      // Legacy call where userId was omitted and first arg is updates
      updates = arguments[0]
      sql = arguments[1] || getDb()
      userId = null
    }
    if (!userId || typeof userId === 'function') {
      throw new Error('PreferenceRepository.update requires a valid userId parameter')
    }

    const current = await this.get(userId, sql)
    const allowedKeys = [
      'scan_max_messages', 'default_time_range', 'label_prefix', 'digest_enabled',
      'digest_day', 'digest_hour', 'digest_recipient',
      'onboarding_step', 'has_completed_onboarding', 'protected_categories'
    ]
    const filteredUpdates = {}
    for (const key of allowedKeys) {
      if (updates && updates[key] !== undefined) {
        filteredUpdates[key] = updates[key]
      }
    }
    const merged = { ...current, ...filteredUpdates }
    const protectedCatsJson = JSON.stringify(Array.isArray(merged.protected_categories) ? merged.protected_categories : [])
    await sql`
      INSERT INTO preferences (
        user_id, scan_max_messages, default_time_range, label_prefix, digest_enabled, digest_day, digest_hour, digest_recipient,
        onboarding_step, has_completed_onboarding, protected_categories
      )
      VALUES (
        ${String(userId)}, ${merged.scan_max_messages ?? null}, ${merged.default_time_range}, ${merged.label_prefix}, ${merged.digest_enabled}, ${merged.digest_day}, ${merged.digest_hour}, ${merged.digest_recipient},
        ${merged.onboarding_step || 'welcome'}, ${Boolean(merged.has_completed_onboarding)}, ${protectedCatsJson}
      )
      ON CONFLICT(user_id) DO UPDATE SET
        scan_max_messages = EXCLUDED.scan_max_messages,
        default_time_range = EXCLUDED.default_time_range,
        label_prefix = EXCLUDED.label_prefix,
        digest_enabled = EXCLUDED.digest_enabled,
        digest_day = EXCLUDED.digest_day,
        digest_hour = EXCLUDED.digest_hour,
        digest_recipient = EXCLUDED.digest_recipient,
        onboarding_step = EXCLUDED.onboarding_step,
        has_completed_onboarding = EXCLUDED.has_completed_onboarding,
        protected_categories = EXCLUDED.protected_categories
    `
    return merged
  }
}
