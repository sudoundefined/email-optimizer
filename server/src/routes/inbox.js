import { Router } from 'express'
import { listGroups, groupMessages, listAllLabels, filterMessages, trashByFilterKey, FILTERS } from '../services/inboxService.js'
import { createJob } from '../jobs/jobManager.js'

const router = Router()

router.get('/inbox/groups', async (req, res, next) => {
  try {
    res.json(await listGroups())
  } catch (err) {
    next(err)
  }
})

router.get('/inbox/groups/:key/messages', async (req, res, next) => {
  try {
    const max = Math.min(Number(req.query.max) || 25, 100)
    res.json(await groupMessages(req.params.key, max))
  } catch (err) {
    next(err)
  }
})

router.get('/inbox/labels', async (req, res, next) => {
  try {
    res.json(await listAllLabels())
  } catch (err) {
    next(err)
  }
})

router.get('/inbox/filter', async (req, res, next) => {
  try {
    const { q } = req.query
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'q query parameter is required' })
    }
    const max = Math.min(Number(req.query.max) || 25, 100)
    res.json(await filterMessages(q, max))
  } catch (err) {
    next(err)
  }
})

router.post('/inbox/filter/:key/trash', (req, res, next) => {
  try {
    const { key } = req.params
    if (!FILTERS[key]) {
      return res.status(400).json({ error: `Unknown filter "${key}"` })
    }
    const job = createJob('filter-trash', (emit) => trashByFilterKey(key, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

export default router
