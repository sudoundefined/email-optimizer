import crypto from 'node:crypto'
import { config } from '../config.js'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32  // 256 bits
const IV_LENGTH = 12   // 96 bits (NIST SP 800-38D standard)
const AUTH_TAG_LENGTH = 16

/**
 * Derive a 256-bit key from the configured encryption key string.
 * Uses SHA-256 hash to normalize any length input to exactly 32 bytes.
 */
function getKey() {
  if (!config.tokenEncryptionKey) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return crypto.createHash('sha256').update(config.tokenEncryptionKey).digest()
}

/**
 * Encrypt a tokens object to a storable format.
 * @param {object} tokens - The OAuth tokens to encrypt
 * @returns {{ encrypted: string, iv: string }} - Base64-encoded encrypted data and IV
 */
export function encryptTokens(tokens) {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const plaintext = JSON.stringify(tokens)
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Store authTag appended to encrypted data
  return {
    encrypted: encrypted + '.' + authTag.toString('base64'),
    iv: iv.toString('base64'),
  }
}

/**
 * Decrypt stored token data back to a tokens object.
 * @param {{ encrypted: string, iv: string }} data - The stored encrypted data
 * @returns {object} - The decrypted OAuth tokens
 */
export function decryptTokens({ encrypted, iv }) {
  const key = getKey()

  const [encryptedData, authTagB64] = encrypted.split('.')
  if (!encryptedData || !authTagB64) {
    throw new Error('Invalid encrypted token format')
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))

  let decrypted = decipher.update(encryptedData, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return JSON.parse(decrypted)
}
