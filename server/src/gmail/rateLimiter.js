import pLimit from 'p-limit'

const limit = pLimit(20)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function isRetryable(err) {
  const code = err?.code || err?.response?.status
  if (code === 429 || (code >= 500 && code < 600)) return true
  if (code === 403) {
    const reason = JSON.stringify(err?.response?.data || err?.errors || '')
    return /rateLimitExceeded|userRateLimitExceeded/i.test(reason)
  }
  return false
}

/**
 * Runs fn through the shared concurrency limiter with exponential
 * backoff (500ms → 32s + jitter) on 429/403-rate-limit/5xx errors.
 */
export function limited(fn, { maxAttempts = 5 } = {}) {
  return limit(async () => {
    let attempt = 0
    for (;;) {
      try {
        return await fn()
      } catch (err) {
        attempt++
        if (attempt >= maxAttempts || !isRetryable(err)) throw err
        const backoff = Math.min(500 * 2 ** (attempt - 1), 32000)
        await sleep(backoff + Math.random() * 250)
      }
    }
  })
}
