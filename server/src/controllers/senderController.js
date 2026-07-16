import { createJob } from '../jobs/jobManager.js'
import { runTrashSenders } from '../services/trashService.js'
import { runKeepLatest, isValidSenderEmail } from '../services/retentionService.js'
import { requireScan } from '../store/scanCache.js'
import { filterProtected, isProtected } from '../services/protectService.js'

export const senderController = {
  async trashSenders(req, res, next) {
    try {
      const userId = req.accountId || req.userId
      requireScan(userId)
      const { senderEmails } = req.body || {}
      if (!Array.isArray(senderEmails) || senderEmails.length === 0 || senderEmails.length > 2000 || !senderEmails.every(e => typeof e === 'string')) {
        return res.status(400).json({ error: 'senderEmails must be a non-empty array of strings (max 2000)' })
      }
      const { allowed, excluded } = await filterProtected(userId, senderEmails)
      if (allowed.length === 0) {
        return res.json({ jobId: null, excluded: excluded.length, message: 'All selected senders are protected' })
      }
      const job = createJob(userId, 'trash-senders', (emit) => runTrashSenders(userId, { senderEmails: allowed }, emit))
      res.json({ jobId: job.id, excluded: excluded.length })
    } catch (err) {
      next(err)
    }
  },

  async keepLatest(req, res, next) {
    try {
      const userId = req.accountId || req.userId
      const { senderEmail, keep } = req.body || {}
      if (!isValidSenderEmail(senderEmail)) {
        return res.status(400).json({ error: 'senderEmail must be a valid email address' })
      }
      const n = Number(keep)
      if (!Number.isInteger(n) || n < 1 || n > 1000) {
        return res.status(400).json({ error: 'keep must be an integer between 1 and 1000' })
      }
      const email = senderEmail.trim().toLowerCase()
      const protectedStatus = await isProtected(userId, email)
      if (protectedStatus) {
        return res.json({ jobId: null, protected: true })
      }
      const job = createJob(userId, 'keep-latest', (emit) => runKeepLatest(userId, { senderEmail: email, keep: n }, emit))
      res.json({ jobId: job.id, protected: false })
    } catch (err) {
      next(err)
    }
  }
}
