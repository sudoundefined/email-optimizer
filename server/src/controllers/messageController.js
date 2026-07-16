import { trashMessages, emptyTrash } from '../services/messageTrashService.js'
import { createJob } from '../jobs/jobManager.js'

export const messageController = {
  async trash(req, res, next) {
    try {
      const userId = req.accountId || req.userId
      const { messageIds } = req.body
      if (!Array.isArray(messageIds) || messageIds.length === 0 || messageIds.length > 10_000 || !messageIds.every(id => typeof id === 'string' || typeof id === 'number')) {
        return res.status(400).json({ error: 'messageIds must be a non-empty array of strings/numbers (max 10,000)' })
      }
      const ids = messageIds.map(String)

      if (ids.length <= 200) {
        const result = await trashMessages(userId, ids)
        return res.json(result)
      }

      const job = createJob(userId, 'trash-messages', (emit) => trashMessages(userId, ids, emit))
      res.json({ jobId: job.id })
    } catch (err) {
      next(err)
    }
  },

  async empty(req, res, next) {
    try {
      const userId = req.accountId || req.userId
      const job = createJob(userId, 'empty-trash', (emit) => emptyTrash(userId, emit))
      res.json({ jobId: job.id })
    } catch (err) {
      next(err)
    }
  }
}
