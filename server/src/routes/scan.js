import { Router } from 'express'
import { createJob, isJobRunning } from '../jobs/jobManager.js'
import { runScan, scanView } from '../services/scanService.js'
import { runTrashSenders } from '../services/trashService.js'
import { runKeepLatest, isValidSenderEmail } from '../services/retentionService.js'
import { getScan, requireScan } from '../store/scanCache.js'
import { runAutoProtect, filterProtected, isProtected } from '../services/protectService.js'
import { detectSubscriptions } from '../services/subscriptionsService.js'
import { logActivity } from '../services/auditService.js'

const router = Router()

router.post('/scan', (req, res) => {
  const userId = req.userId
  if (isJobRunning(userId, 'scan')) {
    return res.status(409).json({ error: 'scan_already_running' })
  }
  const { range = '6m', maxMessages } = req.body || {}
  const job = createJob(userId, 'scan', async (emit, signal) => {
    const result = await runScan(userId, { range, maxMessages }, emit, signal)
    try {
      const scan = getScan(userId)
      if (scan) {
        const added = runAutoProtect(userId, scan.senders)
        if (added.length > 0) emit({ phase: 'auto-protect', added: added.length })
      }
      logActivity(userId, 'scan', { senders: result.senders, messages: result.messages, range })
    } catch { /* non-fatal */ }
    return result
  })
  res.json({ jobId: job.id })
})

router.get('/senders', (req, res) => {
  const scan = getScan(req.userId)
  if (!scan) return res.status(404).json({ error: 'no_scan', message: 'No scan data found. Please run a new scan.' })
  res.json(scanView(scan))
})

router.get('/subscriptions', (req, res) => {
  const scan = getScan(req.userId)
  if (!scan) return res.status(404).json({ error: 'no_scan', message: 'No scan data found. Please run a new scan.' })
  res.json(detectSubscriptions(scan.senders))
})

router.post('/senders/trash', (req, res, next) => {
  try {
    const userId = req.userId
    requireScan(userId)
    const { senderEmails } = req.body || {}
    if (!Array.isArray(senderEmails) || senderEmails.length === 0) {
      return res.status(400).json({ error: 'senderEmails must be a non-empty array' })
    }
    const { allowed, excluded } = filterProtected(userId, senderEmails)
    if (allowed.length === 0) {
      return res.json({ jobId: null, excluded: excluded.length, message: 'All selected senders are protected' })
    }
    const job = createJob(userId, 'trash-senders', (emit) => runTrashSenders(userId, { senderEmails: allowed }, emit))
    res.json({ jobId: job.id, excluded: excluded.length })
  } catch (err) {
    next(err)
  }
})

router.post('/senders/keep-latest', (req, res, next) => {
  try {
    const userId = req.userId
    const { senderEmail, keep } = req.body || {}
    if (!isValidSenderEmail(senderEmail)) {
      return res.status(400).json({ error: 'senderEmail must be a valid email address' })
    }
    const n = Number(keep)
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      return res.status(400).json({ error: 'keep must be an integer between 1 and 1000' })
    }
    const email = senderEmail.trim().toLowerCase()
    if (isProtected(userId, email)) {
      return res.json({ jobId: null, protected: true })
    }
    const job = createJob(userId, 'keep-latest', (emit) => runKeepLatest(userId, { senderEmail: email, keep: n }, emit))
    res.json({ jobId: job.id, protected: false })
  } catch (err) {
    next(err)
  }
})

export default router
