import { Router } from 'express'
import { trashMessages, emptyTrash } from '../services/messageTrashService.js'
import { createJob } from '../jobs/jobManager.js'

const router = Router()

/**
 * POST /api/messages/trash
 * Body: { messageIds: string[] }
 * Small batches (<=200) run inline; larger batches run as a background job.
 */
router.post('/messages/trash', async (req, res, next) => {
  try {
    const { messageIds } = req.body
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds must be a non-empty array' })
    }
    const ids = messageIds.map(String).slice(0, 10_000) // safety cap

    if (ids.length <= 200) {
      // small batch — run synchronously, return result directly
      const result = await trashMessages(ids)
      return res.json(result)
    }

    // large batch — run as job so client can stream progress
    const job = createJob('trash-messages', (emit) => trashMessages(ids, emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/messages/trash
 * Permanently delete all messages currently in the Trash.
 */
router.delete('/messages/trash', async (req, res, next) => {
  try {
    const job = createJob('empty-trash', (emit) => emptyTrash(emit))
    res.json({ jobId: job.id })
  } catch (err) {
    next(err)
  }
})

export default router
