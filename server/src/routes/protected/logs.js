import express from 'express'
import { ActivityLogRepository, ScanMetadataRepository } from '../../models/index.js'
import { logger } from '../../middleware/logger.js'

const router = express.Router()

/**
 * GET /api/logs/recent
 * Retrieve recent activity audit trail entries for the authenticated tenant.
 */
router.get('/logs/recent', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200)
    logger.info(`Fetching recent activity logs (${limit} max)`, { userId: req.userId })
    
    const logs = await ActivityLogRepository.findRecent(req.userId, limit)
    res.json({ ok: true, count: logs.length, logs })
  } catch (err) {
    logger.error(`Failed to retrieve activity logs: ${err.message}`, { userId: req.userId })
    next(err)
  }
})

/**
 * GET /api/logs/metadata
 * Retrieve diagnostic scan timing and profiling history for the authenticated tenant.
 */
router.get('/logs/metadata', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100)
    logger.info(`Fetching recent scan metadata history (${limit} max)`, { userId: req.userId })
    
    const metadata = await ScanMetadataRepository.listRecent(req.userId, limit)
    res.json({ ok: true, count: metadata.length, metadata })
  } catch (err) {
    logger.error(`Failed to retrieve scan metadata: ${err.message}`, { userId: req.userId })
    next(err)
  }
})

/**
 * POST /api/logs/client
 * Forward client-side UI console warnings or errors directly onto the backend terminal screen.
 */
router.post('/logs/client', async (req, res, next) => {
  try {
    const { level = 'info', message = 'Client Event', context = {} } = req.body
    
    logger.client(level, message, { userId: req.userId, ...context })
    
    res.json({ ok: true, status: 'logged_on_screen' })
  } catch (err) {
    logger.error(`Error processing client log: ${err.message}`)
    next(err)
  }
})

export default router
