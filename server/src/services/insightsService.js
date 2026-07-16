import { getDb } from '../db/db.js'
import { ScanCacheRepository } from '../models/ScanCacheRepository.js'
import { normalizationEngine } from './insights/normalizationEngine.js'
import { scoringEngine } from './insights/scoringEngine.js'
import { insightsEngine } from './insights/insightsEngine.js'

/**
 * Insights Service: Orchestrates the calculation, storage, and retrieval of
 * deterministic dashboard scores and explainable widgets.
 */
export const insightsService = {
  /**
   * Run the full calculation pipeline (normalization -> scoring -> widgets) and store to DB.
   */
  async calculateAndStoreInsights(userId, sql = getDb()) {
    const normalized = await normalizationEngine.normalize(userId, sql)
    const scores = scoringEngine.calculateScores(normalized)
    const widgets = insightsEngine.generateWidgets(normalized, scores)

    await ScanCacheRepository.upsert(userId, {
      totalMessages: normalized.totalEmails,
      totalSenders: normalized.senderCount,
      unreadMessages: normalized.unreadCount,
      storageUsedMb: normalized.totalStorageMB,
      recoverableStorageMb: scores.cleanupPotential.storageMB,
      healthScore: scores.healthScore,
      cleanupScore: scores.cleanupPotential.percentageOfTotal,
      organizationScore: scores.secondary.organizationScore,
      securityScore: scores.secondary.securityScore,
      newsletterCount: normalized.totalSubscriptionSenders,
      largeAttachmentCount: 0,
      mailboxDna: widgets.dna,
      dashboardJson: {
        scores,
        widgets,
        updatedAt: Date.now()
      }
    }, sql)

    return { scores, widgets }
  },

  /**
   * Get complete dashboard insights, utilizing cached results if available.
   */
  async getDashboardInsights(userId, sql = getDb()) {
    const cached = await ScanCacheRepository.getByUserId(userId, sql)
    if (cached && cached.dashboard_json && cached.dashboard_json.scores && cached.dashboard_json.widgets) {
      return {
        scores: cached.dashboard_json.scores,
        widgets: cached.dashboard_json.widgets,
        cachedAt: cached.dashboard_json.updatedAt || cached.updated_at
      }
    }
    const fresh = await this.calculateAndStoreInsights(userId, sql)
    return { ...fresh, cachedAt: Date.now() }
  },

  /**
   * Force recalculation of insights (e.g., right after a scan or cleanup action).
   */
  async recalculateInsights(userId, sql = getDb()) {
    return this.calculateAndStoreInsights(userId, sql)
  },

  /**
   * Get specific widget: Health
   */
  async getHealthInsights(userId, sql = getDb()) {
    const data = await this.getDashboardInsights(userId, sql)
    return {
      scores: data.scores,
      healthWidget: data.widgets.health
    }
  },

  /**
   * Get specific widget: Top 5 Priorities
   */
  async getPriorities(userId, sql = getDb()) {
    const data = await this.getDashboardInsights(userId, sql)
    return {
      priorities: data.widgets.topPriorities
    }
  },

  /**
   * Get specific widget: Mailbox DNA
   */
  async getMailboxDna(userId, sql = getDb()) {
    const data = await this.getDashboardInsights(userId, sql)
    return {
      dna: data.widgets.dna
    }
  },

  /**
   * Get specific widget: Achievements
   */
  async getAchievements(userId, sql = getDb()) {
    const data = await this.getDashboardInsights(userId, sql)
    return {
      achievements: data.widgets.achievements
    }
  }
}
