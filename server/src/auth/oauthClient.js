import crypto from 'node:crypto'
import { google } from 'googleapis'
import { config, SCOPES } from '../config.js'
import { getDb } from '../db/db.js'
import { encryptTokens, decryptTokens } from '../db/crypto.js'

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

export function getAuthUrl() {
  const client = makeOAuth2Client()
  const state = crypto.randomBytes(16).toString('hex')
  pendingStates.set(state, Date.now())
  // Prune expired states
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

/**
 * Handle the OAuth callback: exchange code, fetch Google profile,
 * upsert user in DB, store encrypted tokens.
 * @returns {{ userId: string, email: string }} The authenticated user
 */
export async function handleCallback(code, state) {
  if (!state || !pendingStates.has(state)) {
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

  const db = getDb()

  // Upsert user
  db.prepare(`
    INSERT INTO users (id, email, display_name, avatar_url, last_login_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      last_login_at = datetime('now')
  `).run(userId, email, displayName, avatarUrl)

  // Encrypt and store tokens
  const { encrypted, iv } = encryptTokens(tokens)
  db.prepare(`
    INSERT INTO tokens (user_id, encrypted, iv, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      encrypted = excluded.encrypted,
      iv = excluded.iv,
      updated_at = datetime('now')
  `).run(userId, encrypted, iv)

  // Ensure preferences row exists
  db.prepare(`
    INSERT OR IGNORE INTO preferences (user_id) VALUES (?)
  `).run(userId)

  return { userId, email, displayName, avatarUrl }
}

/**
 * Returns an authorized OAuth2 client for the given user.
 * Decrypts tokens from SQLite and sets up auto-refresh persistence.
 */
export async function getAuthedClient(userId) {
  const db = getDb()
  const row = db.prepare('SELECT encrypted, iv FROM tokens WHERE user_id = ?').get(userId)

  if (!row) {
    throw new NotConnectedError()
  }

  let tokens
  try {
    tokens = decryptTokens(row)
  } catch {
    throw new NotConnectedError('Failed to decrypt tokens — please sign in again.')
  }

  if (!tokens.refresh_token && !tokens.access_token) {
    throw new NotConnectedError()
  }

  const client = makeOAuth2Client()
  client.setCredentials(tokens)

  // Persist refreshed tokens automatically
  client.on('tokens', (fresh) => {
    try {
      const merged = { ...tokens, ...fresh }
      const { encrypted, iv } = encryptTokens(merged)
      db.prepare(`
        UPDATE tokens SET encrypted = ?, iv = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(encrypted, iv, userId)
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
        const db = getDb()
        db.prepare('DELETE FROM tokens WHERE user_id = ?').run(userId)
      }
      throw new NotConnectedError('Google session expired — please sign in again.')
    }
    throw err
  }
}

export async function revokeAndLogout(userId) {
  const db = getDb()
  const row = db.prepare('SELECT encrypted, iv FROM tokens WHERE user_id = ?').get(userId)

  if (row) {
    try {
      const tokens = decryptTokens(row)
      if (tokens.access_token || tokens.refresh_token) {
        const client = makeOAuth2Client()
        client.setCredentials(tokens)
        await client.revokeCredentials()
      }
    } catch {
      // best effort — token may already be invalid
    }
  }

  db.prepare('DELETE FROM tokens WHERE user_id = ?').run(userId)
}

/**
 * Get user profile from the database.
 */
export function getUserFromDb(userId) {
  const db = getDb()
  return db.prepare('SELECT id, email, display_name, avatar_url, created_at, last_login_at FROM users WHERE id = ?').get(userId)
}
