/**
 * Custom color-coded HTTP and Operational Event Logger (`logger.js`).
 * Streams real-time requests and diagnostic events directly to the terminal console screen.
 */

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  info: '\x1b[36m',    // Cyan
  success: '\x1b[32m', // Green
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  client: '\x1b[35m',  // Magenta
  method: '\x1b[34m',  // Blue
}

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

function getStatusColor(status) {
  if (status >= 500) return COLORS.error
  if (status >= 400) return COLORS.warn
  if (status >= 300) return COLORS.info
  return COLORS.success
}

/**
 * Express middleware to log HTTP request execution, duration, and user scoping on screen.
 */
export function requestLogger(req, res, next) {
  // Skip noisy health check ping spam unless failing
  if (req.path === '/api/health' && req.method === 'GET') {
    return next()
  }

  const startTime = Date.now()
  const { method, originalUrl } = req

  res.on('finish', () => {
    const duration = Date.now() - startTime
    const status = res.statusCode
    const statusColor = getStatusColor(status)
    const userScope = req.userId ? ` [Tenant: ${req.userId.substring(0, 12)}...]` : ' [Anonymous]'

    console.log(
      `${COLORS.dim}[${getTimestamp()}]${COLORS.reset} ` +
      `${COLORS.bold}${COLORS.method}${method.padEnd(6)}${COLORS.reset} ` +
      `${originalUrl.padEnd(35)} ` +
      `${statusColor}${status}${COLORS.reset} ` +
      `${COLORS.dim}(${duration}ms)${COLORS.reset}` +
      `${COLORS.info}${userScope}${COLORS.reset}`
    )
  })

  next()
}

/**
 * Screen logger utility for operational diagnostics, background jobs, and client reporting.
 */
export const logger = {
  info(message, context = {}) {
    const ctxStr = Object.keys(context).length ? ` ${COLORS.dim}${JSON.stringify(context)}${COLORS.reset}` : ''
    console.log(`${COLORS.dim}[${getTimestamp()}]${COLORS.reset} ${COLORS.info}[INFO]${COLORS.reset}  ${message}${ctxStr}`)
  },

  warn(message, context = {}) {
    const ctxStr = Object.keys(context).length ? ` ${COLORS.dim}${JSON.stringify(context)}${COLORS.reset}` : ''
    console.warn(`${COLORS.dim}[${getTimestamp()}]${COLORS.reset} ${COLORS.warn}[WARN]${COLORS.reset}  ${message}${ctxStr}`)
  },

  error(message, context = {}) {
    const ctxStr = Object.keys(context).length ? ` ${COLORS.dim}${JSON.stringify(context)}${COLORS.reset}` : ''
    console.error(`${COLORS.dim}[${getTimestamp()}]${COLORS.reset} ${COLORS.error}[ERROR]${COLORS.reset} ${message}${ctxStr}`)
  },

  /**
   * Log messages forwarded from the frontend UI screen onto the backend terminal screen.
   */
  client(level = 'info', message, context = {}) {
    const lvlColor = level === 'error' ? COLORS.error : level === 'warn' ? COLORS.warn : COLORS.client
    const ctxStr = Object.keys(context).length ? ` ${COLORS.dim}${JSON.stringify(context)}${COLORS.reset}` : ''
    console.log(`${COLORS.dim}[${getTimestamp()}]${COLORS.reset} ${lvlColor}[UI-${level.toUpperCase()}]${COLORS.reset} ${message}${ctxStr}`)
  }
}
