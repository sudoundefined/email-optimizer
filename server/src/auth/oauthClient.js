import crypto from 'node:crypto'
import { google } from 'googleapis'
import { config, SCOPES } from '../config.js'
import { UserRepository } from '../models/UserRepository.js'
import { TokenRepository } from '../models/TokenRepository.js'
import { PreferenceRepository } from '../models/PreferenceRepository.js'

export class NotConnectedError extends Error {
  constructor(message = 'Not connected to Gmail') {
    super(message)
    this.name = 'NotConnectedError'
    this.status = 401
  }
}

// CSRF state values pending verification, mapped to their creation time
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

export function getAuthUrlWithState() {
  const client = makeOAuth2Client()
  const state = crypto.randomBytes(16).toString('hex')
  pendingStates.set(state, Date.now())
  // Prune expired states
  for (const [s, t] of pendingStates) {
    if (Date.now() - t > STATE_TTL_MS) pendingStates.delete(s)
  }
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
  return { url, state }
}

/**
 * Handle the OAuth callback: exchange code, fetch Google profile,
 * upsert user workspace in DB, store encrypted tokens via Repositories.
 */
export async function handleCallback(code, state, expectedCookieState) {
  if (!state || !pendingStates.has(state) || (expectedCookieState !== undefined && state !== expectedCookieState)) {
    throw new Error('Invalid OAuth state — possible CSRF or expired login attempt. Try again.')
  }
  pendingStates.delete(state)

  const client = makeOAuth2Client()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  // Fetch Google profile to get stable user ID
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const { data: profile } = await oauth2.userinfo.get()

  const userId = profile.id
  const email = profile.email
  const displayName = profile.name || ''
  const avatarUrl = profile.picture || ''

  // Upsert user via UserRepository
  const user = await UserRepository.upsert({ id: userId, email, displayName, avatarUrl })

  // Encrypt and store tokens via TokenRepository
  await TokenRepository.upsert(userId, tokens)

  // Ensure user workspace preferences row exists via PreferenceRepository
  await PreferenceRepository.upsertDefault(userId)

  return {
    userId,
    accountId: userId,
    email,
    displayName,
    avatarUrl,
    isDefault: true
  }
}

/**
 * Returns an authorized OAuth2 client for the given user workspace.
 * Decrypts tokens from Supabase and sets up auto-refresh persistence.
 */
export async function getAuthedClient(userId) {
  if (config.demoMode || String(userId).startsWith('acc_demo_')) {
    return {
      credentials: { access_token: 'mock_demo_token' },
      setCredentials() {},
      on() {}
    }
  }
  const tokens = await TokenRepository.findByUserId(userId)
  if (!tokens || (!tokens.refresh_token && !tokens.access_token)) {
    throw new NotConnectedError()
  }

  const client = makeOAuth2Client()
  client.setCredentials(tokens)

  // Persist refreshed tokens automatically
  client.on('tokens', async (fresh) => {
    try {
      const current = (await TokenRepository.findByUserId(userId).catch(() => null)) || tokens
      const merged = { ...current, ...fresh }
      await TokenRepository.upsert(userId, merged)
    } catch {
      // best effort
    }
  })

  return client
}

/** Wraps a Gmail API call, converting invalid_grant into NotConnectedError. */
export async function withAuthErrorHandling(fn, userId) {
  try {
    return await fn()
  } catch (err) {
    const msg = String(err?.response?.data?.error || err?.message || '')
    if (msg.includes('invalid_grant') || err?.code === 401 || err?.status === 401) {
      if (userId) {
        await TokenRepository.deleteByUserId(userId).catch(() => {})
      }
      throw new NotConnectedError('Google session expired — please sign in again.')
    }
    throw err
  }
}

export async function revokeAndLogout(userId) {
  const tokens = await TokenRepository.findByUserId(userId).catch(() => null)
  if (tokens && (tokens.access_token || tokens.refresh_token)) {
    try {
      const client = makeOAuth2Client()
      client.setCredentials(tokens)
      await client.revokeCredentials()
    } catch {
      // best effort — token may already be invalid
    }
  }

  await TokenRepository.deleteByUserId(userId).catch(() => {})
}
