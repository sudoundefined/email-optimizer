import { Router } from 'express'
import {
  listProtected,
  protectSenders,
  unprotectSenders,
} from '../services/protectService.js'

const router = Router()

router.get('/protect', async (req, res, next) => {
  try {
    const list = await listProtected()
    res.json({ protected: list })
  } catch (err) { next(err) }
})

router.post('/protect', async (req, res, next) => {
  try {
    const { emails } = req.body || {}
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails must be a non-empty array' })
    }
    await protectSenders(emails)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.delete('/protect', async (req, res, next) => {
  try {
    const { emails } = req.body || {}
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails must be a non-empty array' })
    }
    await unprotectSenders(emails)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
