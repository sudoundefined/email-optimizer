import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { config } from './config.js'
import { getDb, closeDb } from './db/db.js'
import { authMiddleware } from './middleware/auth.js'
import { globalRateLimiter, userRateLimiter } from './middleware/rateLimit.js'
import { securityHeaders, csrfProtection } from './middleware/security.js'
import { NotConnectedError } from './auth/oauthClient.js'

import authRoutes from './routes/auth.js'
import legalRoutes from './routes/legal.js'
import protectedRoutes from './routes/protected/index.js'
import { requestLogger, logger } from './middleware/logger.js'
import { startScheduler } from './jobs/scheduler.js'

// Initialize database pool on boot
getDb()

const app = express()

app.use(securityHeaders)

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}))
app.use(cookieParser())
app.use(express.json())
app.use(requestLogger)
app.use(globalRateLimiter)

// Public routes
app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/', legalRoutes)
app.use('/api/auth', authRoutes)

// Protected API routes — require JWT cookie + CSRF check + user rate limit
app.use('/api', authMiddleware, csrfProtection, userRateLimiter, protectedRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof NotConnectedError) {
    return res.status(401).json({ error: 'not_connected', message: err.message })
  }
  const status = err.status || 500
  if (status >= 500) logger.error(`Unhandled error (${status}): ${err.message}`, { path: req.path })
  res.status(status).json({ error: err.message || 'internal_error' })
})

const server = app.listen(config.port, config.host, () => {
  logger.info(`API server listening on http://${config.host}:${config.port}`)
  startScheduler()
})

process.on('SIGTERM', () => {
  server.close(async () => {
    await closeDb()
    process.exit(0)
  })
})

export default app
