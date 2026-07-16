import { createJob, isJobRunning } from '../jobs/jobManager.js'
import { getState, saveSettings } from '../store/digestStore.js'
import { runDigest } from '../services/digestRunner.js'

export const digestController = {
  async getState(req, res, next) {
    try {
      const userId = req.accountId || req.userId
      const state = await getState(userId)
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
  },

  async updateSettings(req, res, next) {
    try {
      const userId = req.accountId || req.userId
      const settings = await saveSettings(userId, req.body || {})
      res.json({ settings })
    } catch (err) {
      next(err)
    }
  },

  run(req, res) {
    const userId = req.accountId || req.userId
    if (isJobRunning(userId, 'digest')) {
      return res.status(409).json({ error: 'digest_already_running', message: 'A digest run is already in progress.' })
    }
    const job = createJob(userId, 'digest', (emit) => runDigest(userId, { range: '6m' }, emit))
    res.json({ jobId: job.id })
  },

  preview(req, res) {
    const userId = req.accountId || req.userId
    if (isJobRunning(userId, 'digest')) {
      return res.status(409).json({ error: 'digest_already_running', message: 'A digest run is already in progress.' })
    }
    const job = createJob(userId, 'digest', (emit) => runDigest(userId, { range: '6m', dryRun: true }, emit))
    res.json({ jobId: job.id })
  }
}
