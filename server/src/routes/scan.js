import { Router } from 'express'
import { createJob, isJobRunning } from '../jobs/jobManager.js'
import { runScan, scanView } from '../services/scanService.js'
import { runTrashSenders } from '../services/trashService.js'
import { getScan, requireScan } from '../store/scanCache.js'

const router = Router()

router.post('/scan', (req, res) => {
  if (isJobRunning('scan')) {
    return res.status(409).json({ error: 'scan_already_running' })
  }
  const { range = '6m', maxMessages } = req.body || {}
  const job = createJob('scan', (emit) => runScan({ range, maxMessages }, emit))
  res.json({ jobId: job.id })
})

router.get('/senders', (req, res) => {
  const scan = getScan()
  if (!scan) return res.status(404).json({ error: 'no_scan' })
  res.json(scanView(scan))
})

router.post('/senders/trash', (req, res, next) => {
  try {
    requireScan()
    const { senderEmails } = req.body || {}
    if (!Array.isArray(senderEmails) || senderEmails.length === 0) {
      return res.status(400).json({ error: 'senderEmails must be a non-empty array' })
    }
    const job = createJob('trash-senders', (emit) => runTrashSenders({ senderEmails }, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

export default router
