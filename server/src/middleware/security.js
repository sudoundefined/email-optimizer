import dns from 'node:dns/promises'
import net from 'node:net'
import { config } from '../config.js'

function normalizeOrigin(urlStr) {
  return String(urlStr || '').replace(/\/+$/, '').toLowerCase()
}

/**
 * Express middleware to enforce Origin/Referer verification on mutating HTTP requests (CSRF defense).
 */
export function csrfProtection(req, res, next) {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin
    const referer = req.headers.referer
    const allowed = [normalizeOrigin(config.corsOrigin), normalizeOrigin(config.clientUrl)]
    if (origin) {
      const normOrigin = normalizeOrigin(origin)
      if (!allowed.includes(normOrigin)) {
        return res.status(403).json({ error: 'CSRF Origin check failed' })
      }
    } else if (referer) {
      const normReferer = normalizeOrigin(referer)
      if (!allowed.some(a => normReferer === a || normReferer.startsWith(a + '/'))) {
        return res.status(403).json({ error: 'CSRF Referer check failed' })
      }
    }
  }
  next()
}

/**
 * Express middleware to set essential HTTP security headers.
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; " +
    "base-uri 'self'; form-action 'self'"
  )
  next()
}

/**
 * Check if an IP address falls within private/loopback/link-local ranges (SSRF defense).
 */
export function isPrivateIp(ip) {
  if (!net.isIP(ip)) return false
  // IPv4 loopback and unspecified
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true
  // RFC 1918 private ranges
  if (ip.startsWith('10.')) return true
  if (ip.startsWith('192.168.')) return true
  if (ip.startsWith('169.254.')) return true // Cloud metadata service + link-local
  if (ip.startsWith('172.')) {
    const secondOctet = parseInt(ip.split('.')[1], 10)
    if (secondOctet >= 16 && secondOctet <= 31) return true
  }
  // IPv6 private ranges
  const lower = ip.toLowerCase()
  if (lower.startsWith('fe80:')) return true    // Link-local IPv6
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // Unique local addresses (fc00::/7)
  if (lower.startsWith('::ffff:')) {             // IPv4-mapped IPv6
    const v4part = lower.slice(7)
    if (net.isIPv4(v4part)) return isPrivateIp(v4part)
  }
  return false
}

/**
 * Validate an external URL before performing outbound fetch (e.g. one-click unsubscribe).
 * Enforces HTTPS and protects against SSRF via private IP ranges / localhost / metadata IPs.
 */
export async function validateExternalUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') {
    throw new Error('Invalid URL provided')
  }

  let parsed
  try {
    parsed = new URL(urlStr)
  } catch {
    throw new Error('Malformed URL string')
  }

  // Enforce HTTPS only
  if (parsed.protocol !== 'https:') {
    throw new Error('SSRF Protection: Only HTTPS URLs are permitted for one-click unsubscribe')
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block obvious hostnames
  if (hostname === 'localhost' || hostname === 'metadata.google.internal') {
    throw new Error(`SSRF Protection: Hostname "${hostname}" is blocked`)
  }

  // If hostname is already an IP, verify directly
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`SSRF Protection: Target IP "${hostname}" is in a private/loopback range`)
    }
    return true
  }

  // Resolve hostname DNS to check IP targets
  try {
    const lookupResult = await dns.lookup(hostname)
    if (lookupResult && isPrivateIp(lookupResult.address)) {
      throw new Error(`SSRF Protection: Resolved IP "${lookupResult.address}" is in a private range`)
    }
  } catch (err) {
    if (err.message.includes('SSRF Protection')) throw err
    // If DNS resolution fails entirely, throw clear error
    throw new Error(`SSRF Protection: Unable to resolve hostname "${hostname}"`)
  }

  return true
}
