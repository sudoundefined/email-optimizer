import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { config } from '../config.js'

/**
 * Global rate limiter for all requests (by IP).
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit', message: 'Too many requests — please try again later' },
})

/**
 * Per-user rate limiter for standard authenticated endpoints.
 */
export const userRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.userId || ipKeyGenerator(req, res),
  message: { error: 'rate_limit', message: 'Too many requests — please slow down' },
})

/**
 * Stricter per-user rate limiter for mutation/cleanup actions (unsubscribe, bulk trash, scans).
 * Prevents accidental or abusive flooding of Gmail rate limits.
 */
export const mutationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 20 mutations per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.userId || ipKeyGenerator(req, res),
  message: { error: 'rate_limit', message: 'Too many cleanup actions performed simultaneously — please wait a moment' },
})
