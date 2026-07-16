import { listGroups, groupMessages, listAllLabels, filterMessages, trashByFilterKey, FILTERS, FILTER_DEFS } from '../services/inboxService.js'
import { createJob } from '../jobs/jobManager.js'

export const inboxController = {
  getFilters(req, res) {
    res.json(FILTER_DEFS)
  },

  async getGroups(req, res, next) {
    try {
      res.json(await listGroups(req.accountId || req.userId))
    } catch (err) {
      next(err)
    }
  },

  async getGroupMessages(req, res, next) {
    try {
      const max = Math.min(Number(req.query.max) || 25, 100)
      res.json(await groupMessages(req.accountId || req.userId, req.params.key, max))
    } catch (err) {
      next(err)
    }
  },

  async getLabels(req, res, next) {
    try {
      res.json(await listAllLabels(req.accountId || req.userId))
    } catch (err) {
      next(err)
    }
  },

  async filter(req, res, next) {
    try {
      const { q } = req.query
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'q query parameter is required' })
      }
      const max = Math.min(Number(req.query.max) || 25, 100)
      res.json(await filterMessages(req.accountId || req.userId, q, max))
    } catch (err) {
      next(err)
    }
  },

  trashByFilter(req, res, next) {
    try {
      const { key } = req.params
      if (!FILTERS[key]) {
        return res.status(400).json({ error: `Unknown filter "${key}"` })
      }
      const userId = req.accountId || req.userId
      const job = createJob(userId, 'filter-trash', (emit) => trashByFilterKey(userId, key, emit))
      res.json({ jobId: job.id })
    } catch (err) {
      next(err)
    }
  }
}
