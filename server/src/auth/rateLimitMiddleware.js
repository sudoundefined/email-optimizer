import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { config } from '../config.js'

/**
 * Global rate limiter for all requests (by IP).
 * Applied before auth — catches brute-force login attempts.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,            // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit', message: 'Too many requests — please try again later' },
})

/**
 * Per-user rate limiter for authenticated endpoints.
 * Uses userId from the JWT (set by authMiddleware).
 */
export const userRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.userId || ipKeyGenerator(req, res),
  message: { error: 'rate_limit', message: 'Too many requests — please slow down' },
})
