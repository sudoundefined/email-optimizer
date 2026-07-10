import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(serverRoot, '.env') })

// Auto-generate JWT secret if not provided (persisted by user in .env for production)
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex')
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set — using auto-generated secret. Sessions will not survive server restarts. Set JWT_SECRET in .env for production.')
}

export const config = {
  port: Number(process.env.PORT || 3001),
  // Bind loopback by default so the unauthenticated local API is not exposed to
  // the LAN. Set HOST=0.0.0.0 only behind a trusted reverse proxy / real auth.
  host: process.env.HOST || '127.0.0.1',
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:3001/api/auth/callback',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Database
  dataDir: path.join(serverRoot, 'data'),
  dbPath: process.env.DB_PATH || path.join(serverRoot, 'data', 'emaildiet.db'),

  // Auth
  jwtSecret,
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || '',

  // Cookie settings (for cross-subdomain: set COOKIE_DOMAIN=.yourdomain.com)
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure: process.env.NODE_ENV === 'production',

  // CORS (for different subdomain deployment)
  corsOrigin: process.env.CORS_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173',

  // Scan limits
  // No scan cap by default — scan the entire matching set. Set
  // SCAN_MAX_MESSAGES to a number to cap it (e.g. to limit Gmail API usage).
  scanMaxMessages: process.env.SCAN_MAX_MESSAGES ? Number(process.env.SCAN_MAX_MESSAGES) : Infinity,
  labelPrefix: 'Unsub/',

  // Rate limiting
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 60),
}

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
]
