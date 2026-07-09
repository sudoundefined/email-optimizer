import { Router } from 'express'
import { createJob, isJobRunning } from '../jobs/jobManager.js'
import { getState, saveSettings } from '../store/digestStore.js'
import { runDigest } from '../services/digestRunner.js'
import { readTokens } from '../auth/tokenStore.js'
import { NotConnectedError } from '../auth/oauthClient.js'

const router = Router()

// All digest endpoints require a connected Google account. This closes the
// unauthenticated read of mailbox-derived state and prevents configuring a
// scheduled send (recipient, enable) while disconnected.
async function requireConnected() {
  const tokens = await readTokens()
  if (!tokens || (!tokens.refresh_token && !tokens.access_token)) {
    throw new NotConnectedError()
  }
}

// GET /api/digest — settings + last run + history (no secrets)
router.get('/digest', async (req, res, next) => {
  try {
    await requireConnected()
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
    await requireConnected()
    const settings = await saveSettings(req.body || {})
    res.json({ settings })
  } catch (err) {
    next(err)
  }
})

// POST /api/digest/run — trigger a real digest now (background job)
router.post('/digest/run', async (req, res, next) => {
  try {
    await requireConnected()
    if (isJobRunning('digest')) {
      return res.status(409).json({ error: 'digest_already_running', message: 'A digest run is already in progress.' })
    }
    const job = createJob('digest', (emit) => runDigest({ range: '6m' }, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

// POST /api/digest/preview — compute new senders without sending (background job)
router.post('/digest/preview', async (req, res, next) => {
  try {
    await requireConnected()
    if (isJobRunning('digest')) {
      return res.status(409).json({ error: 'digest_already_running', message: 'A digest run is already in progress.' })
    }
    const job = createJob('digest', (emit) => runDigest({ range: '6m', dryRun: true }, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

export default router
