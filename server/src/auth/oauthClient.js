import crypto from 'node:crypto'
import { google } from 'googleapis'
import { config, SCOPES } from '../config.js'
import { readTokens, writeTokens, updateTokens, deleteTokens } from './tokenStore.js'

export class NotConnectedError extends Error {
  constructor(message = 'Not connected to Gmail') {
    super(message)
    this.name = 'NotConnectedError'
    this.status = 401
  }
}

// state values pending verification, mapped to their creation time
const pendingStates = new Map()
const STATE_TTL_MS = 10 * 60 * 1000

function makeOAuth2Client() {
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      'Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Copy server/.env.example to server/.env and fill in your credentials.'
    )
  }
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
}

export function getAuthUrl() {
  const client = makeOAuth2Client()
  const state = crypto.randomBytes(16).toString('hex')
  pendingStates.set(state, Date.now())
  for (const [s, t] of pendingStates) {
    if (Date.now() - t > STATE_TTL_MS) pendingStates.delete(s)
  }
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
}

export async function handleCallback(code, state) {
  if (!state || !pendingStates.has(state)) {
    throw new Error('Invalid OAuth state — possible CSRF or expired login attempt. Try again.')
  }
  pendingStates.delete(state)
  const client = makeOAuth2Client()
  const { tokens } = await client.getToken(code)
  await writeTokens(tokens)
  return tokens
}

/**
 * Returns an authorized OAuth2 client, refreshing tokens as needed.
 * Throws NotConnectedError when there are no tokens or the refresh
 * token is dead (invalid_grant — e.g. 7-day Testing-mode expiry).
 */
export async function getAuthedClient() {
  const tokens = await readTokens()
  if (!tokens || (!tokens.refresh_token && !tokens.access_token)) {
    throw new NotConnectedError()
  }
  const client = makeOAuth2Client()
  client.setCredentials(tokens)
  client.on('tokens', (fresh) => {
    updateTokens(fresh).catch(() => {})
  })
  return client
}

/** Wraps a Gmail API call, converting invalid_grant into NotConnectedError. */
export async function withAuthErrorHandling(fn) {
  try {
    return await fn()
  } catch (err) {
    const msg = String(err?.response?.data?.error || err?.message || '')
    if (msg.includes('invalid_grant') || err?.code === 401 || err?.status === 401) {
      await deleteTokens()
      throw new NotConnectedError('Google session expired — please sign in again.')
    }
    throw err
  }
}

export async function revokeAndLogout() {
  const tokens = await readTokens()
  if (tokens?.access_token || tokens?.refresh_token) {
    try {
      const client = makeOAuth2Client()
      client.setCredentials(tokens)
      await client.revokeCredentials()
    } catch {
      // best effort — token may already be invalid
    }
  }
  await deleteTokens()
}
