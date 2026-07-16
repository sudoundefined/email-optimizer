import { getAuthUrlWithState, handleCallback, revokeAndLogout } from '../auth/oauthClient.js'
import { signToken, verifyToken } from '../auth/jwt.js'
import { COOKIE_NAME, clearUserCache } from '../middleware/auth.js'
import { logActivity } from '../services/auditService.js'
import { config } from '../config.js'
import { serializeUser } from '../serializers/userSerializer.js'
import { UserRepository } from '../models/UserRepository.js'

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export const authController = {
  async status(req, res) {
    const token = req.cookies?.[COOKIE_NAME]
    if (!token) {
      return res.json({ connected: false })
    }
    try {
      const payload = verifyToken(token)
      const user = await UserRepository.findById(payload.sub)
      if (!user) {
        return res.json({ connected: false })
      }

      return res.json({
        connected: true,
        email: user.email,
        user: serializeUser(user),
        accounts: [{
          id: user.id,
          email: user.email,
          displayName: user.display_name || user.displayName || user.email.split('@')[0],
          avatarUrl: user.avatar_url || user.avatarUrl || '',
          isDefault: true,
          lastLoginAt: user.last_login_at || user.created_at || null
        }]
      })
    } catch {
      return res.json({ connected: false })
    }
  },

  login(req, res, next) {
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
  },

  async callback(req, res) {
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

      await logActivity(user.userId, 'login', { email: user.email })

      res.redirect(config.clientUrl)
    } catch (err) {
      res
        .status(400)
        .send(
          `<h3>Sign-in failed</h3><p>${escapeHtml(err.message)}</p><p><a href="${config.clientUrl}">Back to app</a></p>`
        )
    }
  },

  async demoLogin(req, res, next) {
    try {
      if (!config.demoMode && process.env.NODE_ENV === 'production') {
        const status = res.status ? res.status(404) : res
        return status.json({ error: 'not_found', message: 'Demo mode is not enabled on this server' })
      }

      config.demoMode = true
      const { DEMO_ACCOUNTS } = await import('../gmail/mockDataset.js')
      const { seedDemoAccount } = await import('../../scripts/seedDb.js')
      const demoAccount = DEMO_ACCOUNTS[0]

      try {
        await seedDemoAccount()
      } catch (seedErr) {
        console.warn('⚠️ Demo seeding skipped or failed (falling back to memory):', seedErr.message)
      }

      const token = signToken(demoAccount.id)
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: 'lax',
        domain: config.cookieDomain,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })

      return res.json({
        ok: true,
        user: {
          id: demoAccount.id,
          email: demoAccount.email,
          displayName: demoAccount.display_name,
          avatarUrl: demoAccount.avatar_url,
          preferences: {
            defaultTimeRange: '6m',
            scanMaxMessages: null,
            labelPrefix: 'Unsub/',
            digestEnabled: true,
            digestDay: 1,
            digestHour: 9,
            digestRecipient: demoAccount.email
          }
        }
      })
    } catch (err) {
      next(err)
    }
  },

  async logout(req, res, next) {
    try {
      const token = req.cookies?.[COOKIE_NAME]
      if (token) {
        try {
          const payload = verifyToken(token)
          await revokeAndLogout(payload.sub)
          clearUserCache(payload.sub)
          await logActivity(payload.sub, 'logout')
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
  },

  async disconnectAccount(req, res, next) {
    try {
      const token = req.cookies?.[COOKIE_NAME]
      if (!token) {
        return res.status(401).json({ error: 'not_authenticated', message: 'Please sign in' })
      }
      let payload
      try {
        payload = verifyToken(token)
      } catch {
        return res.status(401).json({ error: 'invalid_token', message: 'Invalid session' })
      }

      const targetId = req.params.id || req.userId || payload.sub
      if (targetId !== payload.sub && targetId !== 'me') {
        return res.status(404).json({ error: 'account_not_found', message: 'Connected account not found' })
      }

      const userId = payload.sub
      const user = await UserRepository.findById(userId)
      if (!user) {
        return res.status(404).json({ error: 'account_not_found', message: 'User not found' })
      }

      await revokeAndLogout(userId)
      clearUserCache(userId)
      await UserRepository.deleteById(userId)
      await logActivity(userId, 'logout', { action: 'disconnect_account', email: user.email })

      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: 'lax',
        domain: config.cookieDomain,
      })
      return res.json({ ok: true, loggedOut: true })
    } catch (err) {
      next(err)
    }
  }
}
