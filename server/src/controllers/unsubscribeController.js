import { createJob } from '../jobs/jobManager.js'
import { runUnsubscribe } from '../services/unsubscribeService.js'
import { requireScan } from '../store/scanCache.js'
import { filterProtected } from '../services/protectService.js'

export const unsubscribeController = {
  async unsubscribe(req, res, next) {
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
      const job = createJob(userId, 'unsubscribe', (emit) => runUnsubscribe(userId, { senderEmails: allowed }, emit))
      res.json({ jobId: job.id, excluded: excluded.length })
    } catch (err) {
      next(err)
    }
  }
}
