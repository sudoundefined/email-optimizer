import { getStorageStats, clearStorageCache, getDrillDownMessages } from '../services/storageService.js'

export const storageController = {
  async getStats(req, res, next) {
    try {
      const stats = await getStorageStats(req.accountId || req.userId)
      res.json(stats)
    } catch (err) {
      next(err)
    }
  },

  refresh(req, res) {
    clearStorageCache(req.accountId || req.userId)
    res.json({ ok: true })
  },

  getMessages(req, res, next) {
    try {
      const { by, value } = req.query
      if (!by || !value || !['sender', 'month', 'year', 'size'].includes(by)) {
        return res.status(400).json({ error: 'by must be "sender", "month", "year", or "size", value is required' })
      }
      const messages = getDrillDownMessages(req.accountId || req.userId, by, value)
      if (messages === null) {
        return res.status(404).json({ error: 'cache_cold', message: 'Storage not yet analyzed — load the Storage tab first' })
      }
      res.json(messages)
    } catch (err) {
      next(err)
    }
  }
}
