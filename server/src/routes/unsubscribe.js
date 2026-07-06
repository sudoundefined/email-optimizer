import { Router } from 'express'
import { createJob } from '../jobs/jobManager.js'
import { runUnsubscribe } from '../services/unsubscribeService.js'
import { requireScan } from '../store/scanCache.js'

const router = Router()

router.post('/unsubscribe', (req, res, next) => {
  try {
    requireScan()
    const { senderEmails } = req.body || {}
    if (!Array.isArray(senderEmails) || senderEmails.length === 0) {
      return res.status(400).json({ error: 'senderEmails must be a non-empty array' })
    }
    const job = createJob('unsubscribe', (emit) => runUnsubscribe({ senderEmails }, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

export default router
