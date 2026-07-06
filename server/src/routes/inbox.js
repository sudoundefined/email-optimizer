import { Router } from 'express'
import { listGroups, groupMessages, listAllLabels, filterMessages } from '../services/inboxService.js'

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

export default router
