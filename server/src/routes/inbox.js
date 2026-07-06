import { Router } from 'express'
import { listGroups, groupMessages, listAllLabels } from '../services/inboxService.js'

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

export default router
