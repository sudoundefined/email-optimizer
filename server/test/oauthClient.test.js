import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getAuthUrlWithState, handleCallback } from '../src/auth/oauthClient.js'

test('handleCallback rejects mismatched expectedCookieState (Login CSRF protection)', async () => {
  const { state } = getAuthUrlWithState()
  await assert.rejects(
    async () => handleCallback('dummy-code', state, 'different-cookie-state'),
    /Invalid OAuth state/
  )
})

test('handleCallback rejects unknown or expired state', async () => {
  await assert.rejects(
    async () => handleCallback('dummy-code', 'nonexistent-state', 'nonexistent-state'),
    /Invalid OAuth state/
  )
})
