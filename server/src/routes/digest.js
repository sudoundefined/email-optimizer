import { Router } from 'express'
import { createJob, isJobRunning } from '../jobs/jobManager.js'
import { getState, saveSettings } from '../store/digestStore.js'
import { runDigest } from '../services/digestRunner.js'

const router = Router()

// GET /api/digest — settings + last run + history
router.get('/digest', (req, res, next) => {
  try {
    const userId = req.userId
    const state = getState(userId)
    res.json({
      settings: state.settings,
      lastRunAt: state.lastRunAt,
      knownSenderCount: state.baseline.knownSenders.length,
      history: state.history,
      running: isJobRunning(userId, 'digest'),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/digest/settings — update schedule settings
router.post('/digest/settings', (req, res, next) => {
  try {
    const settings = saveSettings(req.userId, req.body || {})
    res.json({ settings })
  } catch (err) {
    next(err)
  }
})

// POST /api/digest/run — trigger a real digest now (background job)
router.post('/digest/run', (req, res) => {
  const userId = req.userId
  if (isJobRunning(userId, 'digest')) {
    return res.status(409).json({ error: 'digest_already_running', message: 'A digest run is already in progress.' })
  }
  const job = createJob(userId, 'digest', (emit) => runDigest(userId, { range: '6m' }, emit))
  res.json({ jobId: job.id })
})

// POST /api/digest/preview — compute new senders without sending (background job)
router.post('/digest/preview', (req, res) => {
  const userId = req.userId
  if (isJobRunning(userId, 'digest')) {
    return res.status(409).json({ error: 'digest_already_running', message: 'A digest run is already in progress.' })
  }
  const job = createJob(userId, 'digest', (emit) => runDigest(userId, { range: '6m', dryRun: true }, emit))
  res.json({ jobId: job.id })
})

export default router
