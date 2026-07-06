import { Router } from 'express'
import { createJob } from '../jobs/jobManager.js'
import { runUnsubscribe } from '../services/unsubscribeService.js'
import { requireScan } from '../store/scanCache.js'
import { filterProtected } from '../services/protectService.js'

const router = Router()

router.post('/unsubscribe', async (req, res, next) => {
  try {
    requireScan()
    const { senderEmails } = req.body || {}
    if (!Array.isArray(senderEmails) || senderEmails.length === 0) {
      return res.status(400).json({ error: 'senderEmails must be a non-empty array' })
    }
    const { allowed, excluded } = await filterProtected(senderEmails)
    if (allowed.length === 0) {
      return res.json({ jobId: null, excluded: excluded.length, message: 'All selected senders are protected' })
    }
    const job = createJob('unsubscribe', (emit) => runUnsubscribe({ senderEmails: allowed }, emit))
    res.json({ jobId: job.id, excluded: excluded.length })
  } catch (err) {
    next(err)
  }
})

export default router
