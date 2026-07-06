import { Router } from 'express'
import { google } from 'googleapis'
import { getAuthUrl, handleCallback, getAuthedClient, revokeAndLogout, NotConnectedError, withAuthErrorHandling } from '../auth/oauthClient.js'
import { config } from '../config.js'

const router = Router()

let profileCache = null // {email, at}
const PROFILE_TTL_MS = 5 * 60 * 1000

router.get('/status', async (req, res, next) => {
  try {
    if (profileCache && Date.now() - profileCache.at < PROFILE_TTL_MS) {
      return res.json({ connected: true, email: profileCache.email })
    }
    const email = await withAuthErrorHandling(async () => {
      const auth = await getAuthedClient()
      const gmail = google.gmail({ version: 'v1', auth })
      const profile = await gmail.users.getProfile({ userId: 'me' })
      return profile.data.emailAddress
    })
    profileCache = { email, at: Date.now() }
    res.json({ connected: true, email })
  } catch (err) {
    if (err instanceof NotConnectedError) {
      profileCache = null
      return res.json({ connected: false })
    }
    next(err)
  }
})

router.get('/login', (req, res, next) => {
  try {
    res.redirect(getAuthUrl())
  } catch (err) {
    next(err)
  }
})

router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query
    if (error) throw new Error(`Google returned: ${error}`)
    if (!code) throw new Error('Missing authorization code')
    await handleCallback(String(code), String(state || ''))
    profileCache = null
    res.redirect(config.clientUrl)
  } catch (err) {
    res
      .status(400)
      .send(
        `<h3>Sign-in failed</h3><p>${escapeHtml(err.message)}</p><p><a href="${config.clientUrl}">Back to app</a></p>`
      )
  }
})

router.post('/logout', async (req, res, next) => {
  try {
    await revokeAndLogout()
    profileCache = null
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export default router
