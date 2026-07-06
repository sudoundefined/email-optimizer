import { test } from 'node:test'
import assert from 'node:assert/strict'
import { limited } from '../src/gmail/rateLimiter.js'

test('limited: returns the fn result on first success (no retry)', async () => {
  let calls = 0
  const out = await limited(() => {
    calls++
    return 'ok'
  })
  assert.equal(out, 'ok')
  assert.equal(calls, 1)
})

test('limited: retries a 429 then succeeds', async () => {
  let calls = 0
  const out = await limited(() => {
    calls++
    if (calls === 1) {
      const err = new Error('rate limited')
      err.code = 429
      throw err
    }
    return 'recovered'
  })
  assert.equal(out, 'recovered')
  assert.equal(calls, 2)
})

test('limited: retries 5xx then gives up after maxAttempts (rethrows last error)', async () => {
  let calls = 0
  await assert.rejects(
    () =>
      limited(
        () => {
          calls++
          const err = new Error('server error')
          err.code = 503
          throw err
        },
        { maxAttempts: 2 }
      ),
    /server error/
  )
  assert.equal(calls, 2)
})

test('limited: does NOT retry a non-retryable error (400), throws immediately', async () => {
  let calls = 0
  await assert.rejects(
    () =>
      limited(() => {
        calls++
        const err = new Error('bad request')
        err.code = 400
        throw err
      }),
    /bad request/
  )
  assert.equal(calls, 1)
})

test('limited: 403 with rateLimitExceeded reason is retryable', async () => {
  let calls = 0
  const out = await limited(() => {
    calls++
    if (calls === 1) {
      const err = new Error('forbidden')
      err.code = 403
      err.response = { data: { error: { errors: [{ reason: 'userRateLimitExceeded' }] } } }
      throw err
    }
    return 'ok'
  })
  assert.equal(out, 'ok')
  assert.equal(calls, 2)
})

test('limited: 403 without a rate-limit reason is NOT retryable', async () => {
  let calls = 0
  await assert.rejects(
    () =>
      limited(() => {
        calls++
        const err = new Error('insufficient permissions')
        err.code = 403
        err.response = { data: { error: { errors: [{ reason: 'insufficientPermissions' }] } } }
        throw err
      }),
    /insufficient permissions/
  )
  assert.equal(calls, 1)
})
