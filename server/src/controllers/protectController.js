import { listProtected, protectSenders, unprotectSenders } from '../services/protectService.js'

export const protectController = {
  async list(req, res, next) {
    try {
      const list = await listProtected(req.accountId || req.userId)
      res.json({ protected: list })
    } catch (err) {
      next(err)
    }
  },

  async add(req, res, next) {
    try {
      const { emails } = req.body || {}
      if (!Array.isArray(emails) || emails.length === 0 || emails.length > 5000 || !emails.every(e => typeof e === 'string')) {
        return res.status(400).json({ error: 'emails must be a non-empty array of strings (max 5000)' })
      }
      await protectSenders(req.accountId || req.userId, emails)
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  },

  async remove(req, res, next) {
    try {
      const { emails } = req.body || {}
      if (!Array.isArray(emails) || emails.length === 0 || emails.length > 5000 || !emails.every(e => typeof e === 'string')) {
        return res.status(400).json({ error: 'emails must be a non-empty array of strings (max 5000)' })
      }
      await unprotectSenders(req.accountId || req.userId, emails)
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  }
}
