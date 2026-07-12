import { Router } from 'express'
import { getUserFromDb } from '../auth/oauthClient.js'
import { getDb } from '../db/db.js'
import { getActivity } from '../services/auditService.js'

const router = Router()

/**
 * GET /api/user/profile — Return authenticated user profile
 */
router.get('/profile', (req, res) => {
  const user = getUserFromDb(req.userId)
  if (!user) {
    return res.status(404).json({ error: 'not_found', message: 'User not found' })
  }
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  })
})

/**
 * GET /api/user/preferences — Get user preferences
 */
router.get('/preferences', (req, res) => {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      scan_max_messages as scanMaxMessages,
      default_time_range as defaultTimeRange,
      label_prefix as labelPrefix,
      digest_enabled as digestEnabled,
      digest_day as digestDay,
      digest_hour as digestHour,
      digest_recipient as digestRecipient
    FROM preferences WHERE user_id = ?
  `).get(req.userId)

  res.json(row || {})
})

/**
 * PATCH /api/user/preferences — Update user preferences
 */
router.patch('/preferences', (req, res) => {
  const {
    scanMaxMessages,
    defaultTimeRange,
    labelPrefix,
  } = req.body

  const db = getDb()
  db.prepare(`
    UPDATE preferences SET
      scan_max_messages = COALESCE(?, scan_max_messages),
      default_time_range = COALESCE(?, default_time_range),
      label_prefix = COALESCE(?, label_prefix)
    WHERE user_id = ?
  `).run(
    scanMaxMessages ?? null,
    defaultTimeRange ?? null,
    labelPrefix ?? null,
    req.userId
  )

  const row = db.prepare(`
    SELECT
      scan_max_messages as scanMaxMessages,
      default_time_range as defaultTimeRange,
      label_prefix as labelPrefix
    FROM preferences WHERE user_id = ?
  `).get(req.userId)

  res.json(row)
})

/**
 * GET /api/user/activity — Get paginated activity log
 */
router.get('/activity', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
  const action = typeof req.query.action === 'string' ? req.query.action : undefined

  const result = getActivity(req.userId, { page, limit, action })
  res.json(result)
})

export default router
