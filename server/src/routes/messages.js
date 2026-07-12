import { Router } from 'express'
import { trashMessages, emptyTrash } from '../services/messageTrashService.js'
import { createJob } from '../jobs/jobManager.js'

const router = Router()

router.post('/messages/trash', async (req, res, next) => {
  try {
    const userId = req.userId
    const { messageIds } = req.body
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds must be a non-empty array' })
    }
    const ids = messageIds.map(String).slice(0, 10_000)

    if (ids.length <= 200) {
      const result = await trashMessages(userId, ids)
      return res.json(result)
    }

    const job = createJob(userId, 'trash-messages', (emit) => trashMessages(userId, ids, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

router.delete('/messages/trash', async (req, res, next) => {
  try {
    const userId = req.userId
    const job = createJob(userId, 'empty-trash', (emit) => emptyTrash(userId, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

export default router
