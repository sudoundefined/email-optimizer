import { Router } from 'express'
import { createJob, isJobRunning } from '../jobs/jobManager.js'
import { getState, saveSettings } from '../store/digestStore.js'
import { runDigest } from '../services/digestRunner.js'

const router = Router()

// GET /api/digest — settings + last run + history (no secrets)
router.get('/digest', async (req, res, next) => {
  try {
    const state = await getState()
    res.json({
      settings: state.settings,
      lastRunAt: state.lastRunAt,
      knownSenderCount: state.baseline.knownSenders.length,
      history: state.history,
      running: isJobRunning('digest'),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/digest/settings — update schedule settings
router.post('/digest/settings', async (req, res, next) => {
  try {
    const settings = await saveSettings(req.body || {})
    res.json({ settings })
  } catch (err) {
    next(err)
  }
})

// POST /api/digest/run — trigger a real digest now (background job)
router.post('/digest/run', (req, res, next) => {
  try {
    if (isJobRunning('digest')) {
      return res.status(409).json({ error: 'digest_already_running' })
    }
    const job = createJob('digest', (emit) => runDigest({ range: '6m' }, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

// POST /api/digest/preview — compute new senders without sending (background job)
router.post('/digest/preview', (req, res, next) => {
  try {
    if (isJobRunning('digest')) {
      return res.status(409).json({ error: 'digest_already_running' })
    }
    const job = createJob('digest', (emit) => runDigest({ range: '6m', dryRun: true }, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

export default router
