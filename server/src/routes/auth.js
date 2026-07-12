import { Router } from 'express'
import { getAuthUrl, getAuthUrlWithState, handleCallback, revokeAndLogout, getUserFromDb } from '../auth/oauthClient.js'
import { signToken, verifyToken } from '../auth/jwt.js'
import { COOKIE_NAME } from '../auth/authMiddleware.js'
import { logActivity } from '../services/auditService.js'
import { config } from '../config.js'

const router = Router()

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

router.get('/status', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.json({ connected: false })
  }
  try {
    const payload = verifyToken(token)
    const user = getUserFromDb(payload.sub)
    if (!user) {
      return res.json({ connected: false })
    }
    return res.json({
      connected: true,
      email: user.email,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
    })
  } catch {
    return res.json({ connected: false })
  }
})

router.get('/login', (req, res, next) => {
  try {
    const { url, state } = getAuthUrlWithState()
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      domain: config.cookieDomain,
      maxAge: 10 * 60 * 1000,
    })
    res.redirect(url)
  } catch (err) {
    next(err)
  }
})

router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query
    const cookieState = req.cookies?.oauth_state
    res.clearCookie('oauth_state')
    if (error) throw new Error(`Google returned: ${error}`)
    if (!code) throw new Error('Missing authorization code')

    const user = await handleCallback(String(code), String(state || ''), cookieState ? String(cookieState) : undefined)
    const jwtToken = signToken(user.userId)

    res.cookie(COOKIE_NAME, jwtToken, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      domain: config.cookieDomain,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    logActivity(user.userId, 'login', { email: user.email })

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
    const token = req.cookies?.[COOKIE_NAME]
    if (token) {
      try {
        const payload = verifyToken(token)
        await revokeAndLogout(payload.sub)
        logActivity(payload.sub, 'logout')
      } catch {
        // best effort
      }
    }
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      domain: config.cookieDomain,
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
