import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { config } from './config.js'
import { getDb, closeDb } from './db/db.js'
import { authMiddleware } from './auth/authMiddleware.js'
import { globalRateLimiter, userRateLimiter } from './auth/rateLimitMiddleware.js'
import { NotConnectedError } from './auth/oauthClient.js'

import authRoutes from './routes/auth.js'
import userRoutes from './routes/user.js'
import jobRoutes from './routes/jobs.js'
import scanRoutes from './routes/scan.js'
import unsubscribeRoutes from './routes/unsubscribe.js'
import labelRoutes from './routes/labels.js'
import inboxRoutes from './routes/inbox.js'
import protectRoutes from './routes/protect.js'
import storageRoutes from './routes/storage.js'
import messageRoutes from './routes/messages.js'
import digestRoutes from './routes/digest.js'
import legalRoutes from './routes/legal.js'
import { startScheduler } from './jobs/scheduler.js'

// Initialize database on boot
getDb()

const app = express()

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}))
app.use(cookieParser())
app.use(express.json())
app.use(globalRateLimiter)

// Public routes
app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/', legalRoutes)
app.use('/api/auth', authRoutes)

function normalizeOrigin(urlStr) {
  return String(urlStr || '').replace(/\/+$/, '').toLowerCase()
}

function csrfProtection(req, res, next) {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin
    const referer = req.headers.referer
    const allowed = [normalizeOrigin(config.corsOrigin), normalizeOrigin(config.clientUrl)]
    if (origin) {
      const normOrigin = normalizeOrigin(origin)
      if (!allowed.includes(normOrigin)) {
        return res.status(403).json({ error: 'CSRF Origin check failed' })
      }
    } else if (referer) {
      const normReferer = normalizeOrigin(referer)
      if (!allowed.some(a => normReferer === a || normReferer.startsWith(a + '/'))) {
        return res.status(403).json({ error: 'CSRF Referer check failed' })
      }
    }
  }
  next()
}

// Protected API routes — require JWT cookie + CSRF check + user rate limit
app.use('/api', authMiddleware, csrfProtection, userRateLimiter)
app.use('/api/user', userRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api', scanRoutes)
app.use('/api', unsubscribeRoutes)
app.use('/api', labelRoutes)
app.use('/api', inboxRoutes)
app.use('/api', protectRoutes)
app.use('/api', storageRoutes)
app.use('/api', messageRoutes)
app.use('/api', digestRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof NotConnectedError) {
    return res.status(401).json({ error: 'not_connected', message: err.message })
  }
  const status = err.status || 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: err.message || 'internal_error' })
})

const server = app.listen(config.port, config.host, () => {
  console.log(`API server listening on http://${config.host}:${config.port}`)
  startScheduler()
})

process.on('SIGTERM', () => {
  server.close(() => {
    closeDb()
    process.exit(0)
  })
})
