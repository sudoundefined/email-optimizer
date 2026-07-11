import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { config } from '../config.js'

const EXPIRY = '7d'

/**
 * Sign a JWT token for the given user ID.
 * @param {string} userId - The user's Google sub ID
 * @returns {string} - Signed JWT
 */
export function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { algorithm: 'HS256', expiresIn: EXPIRY })
}

/**
 * Verify and decode a JWT token.
 * @param {string} token - The JWT to verify
 * @returns {{ sub: string, iat: number, exp: number }} - Decoded payload
 * @throws If the token is invalid or expired
 */
export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] })
}

/**
 * Generate a random secret suitable for JWT signing.
 * Used when JWT_SECRET is not provided in env.
 */
export function generateSecret() {
  return crypto.randomBytes(64).toString('hex')
}
