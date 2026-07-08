import { Router } from 'express'
import { getStorageStats, clearStorageCache, getDrillDownMessages } from '../services/storageService.js'

const router = Router()

router.get('/storage/stats', async (req, res, next) => {
  try {
    const stats = await getStorageStats()
    res.json(stats)
  } catch (err) { next(err) }
})

router.post('/storage/refresh', async (req, res) => {
  clearStorageCache()
  res.json({ ok: true })
})

/**
 * GET /api/storage/messages?by=sender&value=foo@bar.com
 * GET /api/storage/messages?by=month&value=2024-11
 * Returns messages from the warm cache for drill-down.
 * 404 if cache not warm — client should call /stats first.
 */
router.get('/storage/messages', async (req, res, next) => {
  try {
    const { by, value } = req.query
    if (!by || !value || !['sender', 'month'].includes(by)) {
      return res.status(400).json({ error: 'by must be "sender" or "month", value is required' })
    }
    const messages = getDrillDownMessages(by, value)
    if (messages === null) {
      return res.status(404).json({ error: 'cache_cold', message: 'Storage not yet analyzed — load the Storage tab first' })
    }
    res.json(messages)
  } catch (err) { next(err) }
})

export default router
