import { UserRepository } from '../models/UserRepository.js'
import { PreferenceRepository } from '../models/PreferenceRepository.js'
import { getActivity, getGamificationStats } from '../services/auditService.js'
import { serializeUser } from '../serializers/userSerializer.js'
import { onboardingService } from '../services/onboardingService.js'

export const userController = {
  async getProfile(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const user = await UserRepository.findById(userId)
      if (!user) {
        return res.status(404).json({ error: 'not_found', message: 'User not found' })
      }
      const prefs = await PreferenceRepository.get(userId)
      res.json(serializeUser(user, prefs))
    } catch (err) {
      next(err)
    }
  },

  async getPreferences(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const row = await PreferenceRepository.get(userId)
      res.json({
        scanMaxMessages: row.scan_max_messages,
        defaultTimeRange: row.default_time_range,
        labelPrefix: row.label_prefix,
        digestEnabled: Boolean(row.digest_enabled),
        digestDay: row.digest_day,
        digestHour: row.digest_hour,
        digestRecipient: row.digest_recipient
      })
    } catch (err) {
      next(err)
    }
  },

  async updatePreferences(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const {
        scanMaxMessages,
        defaultTimeRange,
        labelPrefix,
      } = req.body

      const updates = {}
      if (scanMaxMessages !== undefined) {
        const num = Number(scanMaxMessages)
        if (scanMaxMessages !== null && (isNaN(num) || num < 1 || num > 500000)) {
          return res.status(400).json({ error: 'invalid_request', message: 'scanMaxMessages must be a positive number between 1 and 500,000 or null' })
        }
        updates.scan_max_messages = scanMaxMessages === null ? null : Math.floor(num)
      }

      if (defaultTimeRange !== undefined) {
        if (typeof defaultTimeRange !== 'string' || !/^([1-9][0-9]*[dwmy]|all)$/.test(defaultTimeRange)) {
          return res.status(400).json({ error: 'invalid_request', message: 'defaultTimeRange must be a valid duration like 1m, 3m, 6m, 1y, or all' })
        }
        updates.default_time_range = defaultTimeRange
      }

      if (labelPrefix !== undefined) {
        if (typeof labelPrefix !== 'string' || labelPrefix.length > 50 || /[<>&"']/.test(labelPrefix)) {
          return res.status(400).json({ error: 'invalid_request', message: 'labelPrefix must be under 50 characters and not contain HTML markup' })
        }
        updates.label_prefix = labelPrefix
      }

      await PreferenceRepository.update(userId, updates)
      const updated = await PreferenceRepository.get(userId)

      res.json({
        scanMaxMessages: updated.scan_max_messages,
        defaultTimeRange: updated.default_time_range,
        labelPrefix: updated.label_prefix
      })
    } catch (err) {
      next(err)
    }
  },

  async getActivityLog(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const page = Math.max(1, Number(req.query.page) || 1)
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
      const action = typeof req.query.action === 'string' ? req.query.action : undefined

      const result = await getActivity(userId, { page, limit, action })
      res.json(result)
    } catch (err) {
      next(err)
    }
  },

  async getGamification(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const stats = await getGamificationStats(userId)
      res.json(stats)
    } catch (err) {
      next(err)
    }
  },

  async getOnboardingState(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const state = await onboardingService.getOnboardingState(userId)
      res.json(state)
    } catch (err) {
      next(err)
    }
  },

  async updateOnboardingStep(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const { step } = req.body
      const ALLOWED_STEPS = ['welcome', 'privacy', 'config', 'scanning', 'story', 'celebration', 'completed']
      if (!step || typeof step !== 'string' || !ALLOWED_STEPS.includes(step)) {
        return res.status(400).json({ error: 'invalid_request', message: `step must be one of: ${ALLOWED_STEPS.join(', ')}` })
      }
      await PreferenceRepository.update(userId, { onboarding_step: step })
      const state = await onboardingService.getOnboardingState(userId)
      res.json(state)
    } catch (err) {
      next(err)
    }
  },

  async configureOnboardingScan(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const { timeRange, maxMessages, protectedCategories } = req.body
      if (timeRange && !['1m', '3m', '6m', '1y', 'all'].includes(timeRange)) {
        return res.status(400).json({ error: 'invalid_request', message: 'timeRange must be 1m, 3m, 6m, 1y, or all' })
      }
      if (maxMessages !== undefined && maxMessages !== null && (!Number.isInteger(Number(maxMessages)) || Number(maxMessages) < 0)) {
        return res.status(400).json({ error: 'invalid_request', message: 'maxMessages must be a non-negative integer or null' })
      }
      if (protectedCategories !== undefined && !Array.isArray(protectedCategories)) {
        return res.status(400).json({ error: 'invalid_request', message: 'protectedCategories must be an array of strings' })
      }
      const state = await onboardingService.configureOnboardingScan(userId, {
        timeRange,
        maxMessages,
        protectedCategories
      })
      res.json(state)
    } catch (err) {
      next(err)
    }
  },

  async getMailboxStory(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const story = await onboardingService.getMailboxStory(userId)
      res.json(story)
    } catch (err) {
      next(err)
    }
  },

  async completeOnboarding(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const { step = 'completed' } = req.body
      const ALLOWED_STEPS = ['welcome', 'privacy', 'config', 'scanning', 'story', 'celebration', 'completed']
      if (typeof step !== 'string' || !ALLOWED_STEPS.includes(step)) {
        return res.status(400).json({ error: 'invalid_request', message: `step must be one of: ${ALLOWED_STEPS.join(', ')}` })
      }
      const state = await onboardingService.completeOnboarding(userId, { step })
      res.json(state)
    } catch (err) {
      next(err)
    }
  }
}
