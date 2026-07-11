import { Router } from 'express'
import { createJob } from '../jobs/jobManager.js'
import { requireScan } from '../store/scanCache.js'
import { suggestCategory } from '../services/categorizer.js'
import { runApplyLabels, listAppLabels, deleteLabelOnly, runTrashLabel, getLabelMessages, runApplyLabelToFilter } from '../services/labelService.js'

const router = Router()

router.get('/labels/suggestions', (req, res, next) => {
  try {
    const scan = requireScan(req.userId)
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
    const userId = req.userId
    requireScan(userId)
    const { assignments, archive, topLevel } = req.body || {}
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'assignments must be a non-empty array' })
    }
    const opts = { assignments, archive: Boolean(archive) }
    if (topLevel) opts.prefix = ''
    const job = createJob(userId, 'apply-labels', (emit) => runApplyLabels(userId, opts, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

router.post('/labels/apply-filter', (req, res, next) => {
  try {
    const userId = req.userId
    const { query, labelName, archive } = req.body || {}
    if (!query || typeof query !== 'string' || !query.trim() || query.length > 2000) {
      return res.status(400).json({ error: 'query parameter is required (max 2000 chars)' })
    }
    if (!labelName || typeof labelName !== 'string' || !labelName.trim() || labelName.length > 100) {
      return res.status(400).json({ error: 'labelName parameter is required (max 100 chars)' })
    }
    const job = createJob(userId, 'apply-filter-label', (emit) =>
      runApplyLabelToFilter(userId, { query: query.trim(), labelName: labelName.trim(), archive: Boolean(archive) }, emit)
    )
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

router.get('/labels', async (req, res, next) => {
  try {
    res.json(await listAppLabels(req.userId))
  } catch (err) {
    next(err)
  }
})

router.delete('/labels/:id', async (req, res, next) => {
  try {
    const userId = req.userId
    const { mode } = req.query
    if (mode === 'labelOnly') {
      await deleteLabelOnly(userId, req.params.id)
      return res.json({ ok: true })
    }
    if (mode === 'trashEmails') {
      const job = createJob(userId, 'trash-label', (emit) => runTrashLabel(userId, { labelId: req.params.id }, emit))
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
    res.json(await getLabelMessages(req.userId, req.params.id, max))
  } catch (err) {
    next(err)
  }
})

export default router
