import { getDb } from '../db/db.js'
import { PreferenceRepository } from '../models/PreferenceRepository.js'
import { SenderCacheRepository } from '../models/SenderCacheRepository.js'
import { ProtectedSenderRepository } from '../models/ProtectedSenderRepository.js'
import { suggestCategory } from './categorizer.js'
import { matchesDomainHeuristic } from './protectService.js'

/**
 * Service handling the First Login Onboarding Journey lifecycle and Mailbox Story.
 */
export const onboardingService = {
  /**
   * Get the current onboarding state for a user.
   */
  async getOnboardingState(userId, sql = getDb()) {
    const prefs = await PreferenceRepository.get(userId, sql)
    const step = prefs.onboarding_step || 'welcome'
    const isCompleted = Boolean(prefs.has_completed_onboarding)
    const protectedCategories = Array.isArray(prefs.protected_categories) ? prefs.protected_categories : []
    return {
      userId,
      onboardingStep: step,
      hasCompletedOnboarding: isCompleted,
      protectedCategories,
      shouldStartAtDashboard: isCompleted,
      step,
      isCompleted,
    }
  },

  /**
   * Configure scan preferences from Screen 3 (Scan Configuration).
   * Saves time range, max messages, and protected categories, setting onboarding_step to 'scanning'.
   */
  async configureOnboardingScan(userId, { timeRange, maxMessages, protectedCategories = [] }, sql = getDb()) {
    await PreferenceRepository.update(userId, {
      default_time_range: timeRange || '6m',
      scan_max_messages: maxMessages !== undefined && maxMessages !== null ? Number(maxMessages) : null,
      protected_categories: Array.isArray(protectedCategories) ? protectedCategories : [],
      onboarding_step: 'scanning',
    }, sql)

    return this.getOnboardingState(userId, sql)
  },

  /**
   * Automatically protect senders discovered during a scan based on categories selected during onboarding.
   */
  async autoSeedProtectedCategories(userId, sendersMapOrList, sql = getDb()) {
    const prefs = await PreferenceRepository.get(userId, sql)
    const categories = new Set(Array.isArray(prefs.protected_categories) ? prefs.protected_categories.map(c => c.toLowerCase()) : [])
    if (categories.size === 0) return []

    const senders = Array.isArray(sendersMapOrList) ? sendersMapOrList : Array.from(sendersMapOrList.values())
    const toProtect = []

    for (const s of senders) {
      if (!s || !s.email) continue
      const catSuggestion = suggestCategory(s)?.category?.toLowerCase() || ''
      const isDomainMatch = matchesDomainHeuristic(s.domain || '')

      let shouldProtect = false
      if (categories.has('banking') && (catSuggestion === 'banking' || catSuggestion === 'finance' || isDomainMatch)) {
        shouldProtect = true
      } else if (categories.has('government') && (catSuggestion === 'bills' || (s.domain && s.domain.endsWith('.gov')))) {
        shouldProtect = true
      } else if (categories.has('work') && catSuggestion === 'work') {
        shouldProtect = true
      } else if (categories.has('family') && catSuggestion === 'personal') {
        shouldProtect = true
      }

      if (shouldProtect) {
        toProtect.push(s.email)
      }
    }

    if (toProtect.length > 0) {
      const existing = await ProtectedSenderRepository.findByUserId(userId, sql)
      const existingSet = new Set(existing.map(r => r.email.toLowerCase()))
      const newEmails = toProtect.filter(e => !existingSet.has(e.toLowerCase()))
      if (newEmails.length > 0) {
        await ProtectedSenderRepository.insertMany(userId, newEmails, 'auto:onboarding', sql)
      }
    }
    return toProtect
  },

  /**
   * Compute deterministic Mailbox Story metrics (Screen 6) directly after scan.
   */
  async getMailboxStory(userId, sql = getDb()) {
    const senders = await SenderCacheRepository.getByAccountId(userId, sql)
    let totalEmails = 0
    let totalSizeEstimate = 0
    let cleanableMessages = 0
    let cleanableSizeEstimate = 0

    const senderCounts = []

    for (const s of senders) {
      const count = Number(s.messageCount || 0)
      const size = Number(s.totalSizeEstimate || 0)
      totalEmails += count
      totalSizeEstimate += size
      senderCounts.push(count)

      // Cleanable heuristic: Promotions, Newsletters, Shopping, or explicit unsubscribe option available
      const cat = suggestCategory(s)?.category || ''
      const hasUnsub = s.unsubscribe && s.unsubscribe.method && s.unsubscribe.method !== 'none'
      if (cat === 'Promotions' || cat === 'Newsletters' || cat === 'Shopping' || hasUnsub) {
        cleanableMessages += count
        cleanableSizeEstimate += size
      }
    }

    // Sort descending to find minimal top senders contributing >= 70% of total emails
    senderCounts.sort((a, b) => b - a)
    let accumulated = 0
    let topSenderCount = 0
    for (const count of senderCounts) {
      if (totalEmails === 0) break
      accumulated += count
      topSenderCount++
      if (accumulated / totalEmails >= 0.70) break
    }

    const percentage = totalEmails > 0 ? Math.round((accumulated / totalEmails) * 100) : 0
    const storageGB = Number((cleanableSizeEstimate / (1024 * 1024 * 1024)).toFixed(1))
    const storageMB = Number((cleanableSizeEstimate / (1024 * 1024)).toFixed(0))
    const estimatedMinutes = Math.max(1, Math.ceil(cleanableMessages / 40)) // 40 emails/min average speed

    return {
      totalEmails,
      senderCount: senders.length,
      topConcentration: {
        percentage,
        senderCount: topSenderCount,
      },
      cleanupPotential: {
        messages: cleanableMessages,
        storageMB,
        storageGB,
      },
      estimatedMinutes,
      isClean: cleanableMessages === 0 && totalEmails > 0,
    }
  },

  /**
   * Mark onboarding step or transition to completed dashboard.
   */
  async completeOnboarding(userId, { step = 'completed' } = {}, sql = getDb()) {
    const isCompleted = step === 'completed'
    await PreferenceRepository.update(userId, {
      onboarding_step: step,
      has_completed_onboarding: isCompleted,
    }, sql)

    return this.getOnboardingState(userId, sql)
  },

  /**
   * If onboarding is incomplete, transition to completed upon first cleanup
   * and return celebration metrics for Screen 7.
   */
  async triggerOnboardingCelebrationIfApplicable(userId, { emailsCleaned = 0, storageMB = 0 } = {}, sql = getDb()) {
    const prefs = await PreferenceRepository.get(userId, sql)
    if (prefs.has_completed_onboarding) {
      return null
    }

    await PreferenceRepository.update(userId, {
      has_completed_onboarding: true,
      onboarding_step: 'completed'
    }, sql)

    const timeSavedMinutes = Math.round((emailsCleaned * 4) / 60) || 1
    const healthImprovement = Math.min(25, Math.max(5, Math.round(emailsCleaned / 100) + 10))

    return {
      emailsCleaned,
      storageMB,
      timeSavedMinutes,
      healthImprovement
    }
  }
}
