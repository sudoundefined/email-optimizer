import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(serverRoot, '.env') })

export const config = {
  port: Number(process.env.PORT || 3001),
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:3001/api/auth/callback',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  dataDir: path.join(serverRoot, 'data'),
  tokensPath: path.join(serverRoot, 'data', 'tokens.json'),
  labelRegistryPath: path.join(serverRoot, 'data', 'label-registry.json'),
  protectedSendersPath: path.join(serverRoot, 'data', 'protected-senders.json'),
  scanMaxMessages: 5000,
  labelPrefix: 'Unsub/',
}

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
]
