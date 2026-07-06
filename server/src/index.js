import express from 'express'
import { config } from './config.js'
import { NotConnectedError } from './auth/oauthClient.js'
import authRoutes from './routes/auth.js'
import jobRoutes from './routes/jobs.js'
import scanRoutes from './routes/scan.js'
import unsubscribeRoutes from './routes/unsubscribe.js'
import labelRoutes from './routes/labels.js'
import inboxRoutes from './routes/inbox.js'
import protectRoutes from './routes/protect.js'

const app = express()
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api', scanRoutes)
app.use('/api', unsubscribeRoutes)
app.use('/api', labelRoutes)
app.use('/api', inboxRoutes)
app.use('/api', protectRoutes)

// error middleware: NotConnectedError → 401, err.status honored, else 500
app.use((err, req, res, next) => {
  if (err instanceof NotConnectedError) {
    return res.status(401).json({ error: 'not_connected', message: err.message })
  }
  const status = err.status || 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: err.message || 'internal_error' })
})

app.listen(config.port, () => {
  console.log(`API server listening on http://localhost:${config.port}`)
})
