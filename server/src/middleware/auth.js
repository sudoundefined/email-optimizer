import { verifyToken } from '../auth/jwt.js'
import { UserRepository } from '../models/UserRepository.js'

export const COOKIE_NAME = 'auth_token'

const userCache = new Map()
const USER_CACHE_TTL = 60 * 1000 // 60 seconds

/**
 * Clear cached user profile when user logs out or updates profile.
 */
export function clearUserCache(userId) {
  if (userId) {
    userCache.delete(userId)
  } else {
    userCache.clear()
  }
}

async function getCachedUserById(id) {
  const now = Date.now()
  const cached = userCache.get(id)
  if (cached && (now - cached.time) < USER_CACHE_TTL) {
    return cached.user
  }
  const user = await UserRepository.findById(id)
  if (user) {
    userCache.set(id, { user, time: now })
  } else {
    userCache.delete(id)
  }
  return user
}

/**
 * Express middleware that authenticates requests via JWT cookie.
 * Sets `req.userId` and `req.user` (`req.accountId` kept as alias during 1:1 transition).
 * Strictly enforces 1:1 user/account model (no multi-account switching or global table scans).
 */
export async function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]

  if (!token) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Please sign in' })
  }

  let payload
  try {
    payload = verifyToken(token)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token_expired', message: 'Session expired — please sign in again' })
    }
    return res.status(401).json({ error: 'invalid_token', message: 'Invalid session — please sign in again' })
  }

  const primaryId = payload.sub

  try {
    const primaryUser = await getCachedUserById(primaryId)
    if (!primaryUser) {
      return res.status(401).json({ error: 'user_not_found', message: 'User account not found — please sign in again' })
    }

    req.userId = primaryUser.id
    req.userEmail = primaryUser.email
    req.user = primaryUser
    // Legacy aliases during 1:1 transition
    req.accountId = primaryUser.id
    req.accountEmail = primaryUser.email

    // Check if X-Account-Id header is requesting an ID other than the authenticated user's ID.
    // Under the 1:1 user/account architecture, switching to arbitrary IDs is forbidden.
    const requestedAccountId = req.headers['x-account-id']
    if (requestedAccountId && typeof requestedAccountId === 'string' && requestedAccountId.trim() !== '') {
      const targetId = requestedAccountId.trim()
      if (targetId !== primaryUser.id) {
        return res.status(403).json({ error: 'forbidden', message: 'Not authorized to access requested account' })
      }
    }

    res.setHeader('Cache-Control', 'no-store')
    next()
  } catch (err) {
    next(err)
  }
}

