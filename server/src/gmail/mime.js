/**
 * Builders for the RFC 2822 unsubscribe email sent for mailto: links.
 * Pure functions — unit tested.
 */

/** Strips CR/LF (header injection) and trims. */
export function sanitizeHeaderValue(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
}

/**
 * Parses a mailto: URI into {to, subject, body}.
 * Returns null when the URI is not a usable mailto.
 */
export function parseMailto(uri) {
  if (!/^mailto:/i.test(uri || '')) return null
  try {
    const url = new URL(uri)
    const to = decodeURIComponent(url.pathname || '').trim()
    if (!to || !to.includes('@')) return null
    const params = url.searchParams
    return {
      to: sanitizeHeaderValue(to),
      subject: sanitizeHeaderValue(params.get('subject') || 'unsubscribe'),
      body: (params.get('body') || 'unsubscribe').replace(/\r\n?/g, '\n'),
    }
  } catch {
    return null
  }
}

/** Builds a raw RFC 2822 message and returns it base64url-encoded for users.messages.send. */
export function buildUnsubscribeEmail({ to, subject, body }) {
  const lines = [
    `To: ${sanitizeHeaderValue(to)}`,
    `Subject: ${sanitizeHeaderValue(subject)}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body || 'unsubscribe',
  ]
  return base64url(lines.join('\r\n'))
}

export function base64url(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
