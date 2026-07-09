import { Router } from 'express'
import { createJob } from '../jobs/jobManager.js'
import { requireScan } from '../store/scanCache.js'
import { suggestCategory } from '../services/categorizer.js'
import { runApplyLabels, listAppLabels, deleteLabelOnly, runTrashLabel, getLabelMessages } from '../services/labelService.js'

const router = Router()

router.get('/labels/suggestions', (req, res, next) => {
  try {
    const scan = requireScan()
    const suggestions = [...scan.senders.values()].map((s) => ({
      senderEmail: s.email,
      messageCount: s.messageCount,
      ...suggestCategory(s),
    }))
    res.json(suggestions)
  } catch (err) {
    next(err)
  }
})

router.post('/labels/apply', (req, res, next) => {
  try {
    requireScan()
    const { assignments, archive, topLevel } = req.body || {}
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'assignments must be a non-empty array' })
    }
    // topLevel:true → bare organizational labels (Work, Banking…); otherwise the
    // default Unsub/ prefix used by the unsubscribe-labeling flow.
    const opts = { assignments, archive: Boolean(archive) }
    if (topLevel) opts.prefix = ''
    const job = createJob('apply-labels', (emit) => runApplyLabels(opts, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

router.get('/labels', async (req, res, next) => {
  try {
    res.json(await listAppLabels())
  } catch (err) {
    next(err)
  }
})

router.delete('/labels/:id', async (req, res, next) => {
  try {
    const { mode } = req.query
    if (mode === 'labelOnly') {
      await deleteLabelOnly(req.params.id)
      return res.json({ ok: true })
    }
    if (mode === 'trashEmails') {
      const job = createJob('trash-label', (emit) => runTrashLabel({ labelId: req.params.id }, emit))
      return res.json({ jobId: job.id })
    }
    res.status(400).json({ error: 'mode must be labelOnly or trashEmails' })
  } catch (err) {
    next(err)
  }
})

router.get('/labels/:id/messages', async (req, res, next) => {
  try {
    const max = Math.max(1, Math.min(Number(req.query.max) || 25, 100))
    res.json(await getLabelMessages(req.params.id, max))
  } catch (err) {
    next(err)
  }
})

export default router
