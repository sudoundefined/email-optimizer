import { verifyToken } from './jwt.js'

const COOKIE_NAME = 'auth_token'

/**
 * Express middleware that authenticates requests via JWT cookie.
 * Sets req.userId on success, returns 401 on failure.
 */
export function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]

  if (!token) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Please sign in' })
  }

  try {
    const payload = verifyToken(token)
    req.userId = payload.sub
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token_expired', message: 'Session expired — please sign in again' })
    }
    return res.status(401).json({ error: 'invalid_token', message: 'Invalid session — please sign in again' })
  }
}

export { COOKIE_NAME }
