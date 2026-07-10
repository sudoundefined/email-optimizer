import { Router } from 'express'
import { createJob, isJobRunning } from '../jobs/jobManager.js'
import { runScan, scanView } from '../services/scanService.js'
import { runTrashSenders } from '../services/trashService.js'
import { runKeepLatest, isValidSenderEmail } from '../services/retentionService.js'
import { getScan, requireScan } from '../store/scanCache.js'
import { runAutoProtect, filterProtected, isProtected } from '../services/protectService.js'
import { detectSubscriptions } from '../services/subscriptionsService.js'

const router = Router()

router.post('/scan', (req, res) => {
  if (isJobRunning('scan')) {
    return res.status(409).json({ error: 'scan_already_running' })
  }
  const { range = '6m', maxMessages } = req.body || {}
  const job = createJob('scan', async (emit, signal) => {
    const result = await runScan({ range, maxMessages }, emit, signal)
    try {
      const scan = getScan()
      if (scan) {
        const added = await runAutoProtect(scan.senders)
        if (added.length > 0) emit({ phase: 'auto-protect', added: added.length })
      }
    } catch { /* non-fatal */ }
    return result
  })
  res.json({ jobId: job.id })
})

router.get('/senders', (req, res) => {
  const scan = getScan()
  if (!scan) return res.status(404).json({ error: 'no_scan', message: 'No scan data found. Please run a new scan.' })
  res.json(scanView(scan))
})

router.get('/subscriptions', (req, res) => {
  const scan = getScan()
  if (!scan) return res.status(404).json({ error: 'no_scan', message: 'No scan data found. Please run a new scan.' })
  res.json(detectSubscriptions(scan.senders))
})

router.post('/senders/trash', async (req, res, next) => {
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
    const job = createJob('trash-senders', (emit) => runTrashSenders({ senderEmails: allowed }, emit))
    res.json({ jobId: job.id, excluded: excluded.length })
  } catch (err) {
    next(err)
  }
})

router.post('/senders/keep-latest', async (req, res, next) => {
  try {
    const { senderEmail, keep } = req.body || {}
    if (!isValidSenderEmail(senderEmail)) {
      return res.status(400).json({ error: 'senderEmail must be a valid email address' })
    }
    const n = Number(keep)
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      return res.status(400).json({ error: 'keep must be an integer between 1 and 1000' })
    }
    const email = senderEmail.trim().toLowerCase()
    if (await isProtected(email)) {
      return res.json({ jobId: null, protected: true })
    }
    const job = createJob('keep-latest', (emit) => runKeepLatest({ senderEmail: email, keep: n }, emit))
    res.json({ jobId: job.id, protected: false })
  } catch (err) {
    next(err)
  }
})

export default router
