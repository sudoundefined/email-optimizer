import { Router } from 'express'
import {
  listProtected,
  protectSenders,
  unprotectSenders,
} from '../services/protectService.js'

const router = Router()

router.get('/protect', (req, res, next) => {
  try {
    const list = listProtected(req.userId)
    res.json({ protected: list })
  } catch (err) { next(err) }
})

router.post('/protect', (req, res, next) => {
  try {
    const { emails } = req.body || {}
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails must be a non-empty array' })
    }
    protectSenders(req.userId, emails)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.delete('/protect', (req, res, next) => {
  try {
    const { emails } = req.body || {}
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails must be a non-empty array' })
    }
    unprotectSenders(req.userId, emails)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
