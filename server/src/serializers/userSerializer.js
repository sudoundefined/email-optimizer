import { SCAN_DEFAULTS } from '../utils/constants.js'

/**
 * Serializes user profile and preferences for the /api/auth/me or /api/user endpoints.
 * Explicitly strips internal database IDs, tokens, or encryption artifacts.
 */
export function serializeUser(user, preferences = null) {
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || user.displayName || user.email.split('@')[0],
    avatarUrl: user.avatar_url || user.avatarUrl || null,
    lastLoginAt: user.last_login_at || user.lastLoginAt || user.created_at || null,
    preferences: preferences ? {
      scanMaxMessages: preferences.scan_max_messages && Number.isFinite(Number(preferences.scan_max_messages)) && Number(preferences.scan_max_messages) > 0 ? Number(preferences.scan_max_messages) : SCAN_DEFAULTS.MAX_MESSAGES,
      defaultTimeRange: preferences.default_time_range || SCAN_DEFAULTS.TIME_RANGE,
      labelPrefix: preferences.label_prefix || SCAN_DEFAULTS.LABEL_PREFIX,
      digestEnabled: Boolean(preferences.digest_enabled),
      digestDay: preferences.digest_day ?? 1,
      digestHour: preferences.digest_hour ?? 8,
      digestRecipient: preferences.digest_recipient || user.email
    } : null,
    onboarding: preferences ? {
      userId: user.id,
      onboardingStep: preferences.onboarding_step || 'welcome',
      hasCompletedOnboarding: Boolean(preferences.has_completed_onboarding),
      protectedCategories: Array.isArray(preferences.protected_categories) ? preferences.protected_categories : [],
      shouldStartAtDashboard: Boolean(preferences.has_completed_onboarding),
      step: preferences.onboarding_step || 'welcome',
      isCompleted: Boolean(preferences.has_completed_onboarding),
    } : {
      userId: user.id,
      onboardingStep: 'welcome',
      hasCompletedOnboarding: false,
      protectedCategories: [],
      shouldStartAtDashboard: false,
      step: 'welcome',
      isCompleted: false,
    }
  }
}
