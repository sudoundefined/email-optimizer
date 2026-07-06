import { Router } from 'express'
import { getStorageStats, clearStorageCache } from '../services/storageService.js'

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

export default router
