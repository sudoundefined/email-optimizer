import { insightsService } from '../services/insightsService.js'
import { onboardingService } from '../services/onboardingService.js'

export const insightsController = {
  async getDashboard(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const data = await insightsService.getDashboardInsights(userId)
      res.json(data)
    } catch (err) {
      next(err)
    }
  },

  async getHealth(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const data = await insightsService.getHealthInsights(userId)
      res.json(data)
    } catch (err) {
      next(err)
    }
  },

  async getPriorities(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const data = await insightsService.getPriorities(userId)
      res.json(data)
    } catch (err) {
      next(err)
    }
  },

  async getDna(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const data = await insightsService.getMailboxDna(userId)
      res.json(data)
    } catch (err) {
      next(err)
    }
  },

  async getAchievements(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const data = await insightsService.getAchievements(userId)
      res.json(data)
    } catch (err) {
      next(err)
    }
  },

  async getStory(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const story = await onboardingService.getMailboxStory(userId)
      res.json(story)
    } catch (err) {
      next(err)
    }
  },

  async recalculate(req, res, next) {
    try {
      const userId = req.userId || req.accountId
      const data = await insightsService.recalculateInsights(userId)
      res.json(data)
    } catch (err) {
      next(err)
    }
  }
}
