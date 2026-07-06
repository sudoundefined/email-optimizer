/**
 * Pure parsers for From, List-Unsubscribe (RFC 2369) and
 * List-Unsubscribe-Post (RFC 8058) headers. Defensive: real-world
 * headers are messy; any parse failure degrades gracefully.
 */

/** Parses a From header into {name, email}. */
export function parseFrom(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return { name: '', email: '' }

  // "Display Name" <addr@host> | Display Name <addr@host> | <addr@host>
  const angle = raw.match(/<([^<>]+)>\s*$/)
  if (angle) {
    const email = angle[1].trim().toLowerCase()
    let name = raw.slice(0, angle.index).trim()
    name = name.replace(/^"(.*)"$/s, '$1').replace(/\\(["\\])/g, '$1').trim()
    name = decodeEncodedWords(name)
    return { name, email }
  }

  // bare address, possibly with trailing comment
  const bare = raw.match(/[^\s<>,;"']+@[^\s<>,;"']+/)
  if (bare) return { name: '', email: bare[0].toLowerCase() }

  return { name: decodeEncodedWords(raw), email: '' }
}

/** Best-effort RFC 2047 encoded-word decoder (B and Q encodings, utf-8/latin1). */
export function decodeEncodedWords(text) {
  return String(text ?? '').replace(
    /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g,
    (match, charset, enc, data) => {
      try {
        const cs = /^utf-?8$/i.test(charset) ? 'utf8' : 'latin1'
        if (enc.toLowerCase() === 'b') {
          return Buffer.from(data, 'base64').toString(cs)
        }
        // Q encoding: _ = space, =XX = hex byte
        const bytes = []
        for (let i = 0; i < data.length; i++) {
          const c = data[i]
          if (c === '_') bytes.push(0x20)
          else if (c === '=' && i + 2 < data.length + 1) {
            const hex = data.slice(i + 1, i + 3)
            if (/^[0-9a-fA-F]{2}$/.test(hex)) {
              bytes.push(parseInt(hex, 16))
              i += 2
            } else bytes.push(c.charCodeAt(0))
          } else bytes.push(c.charCodeAt(0))
        }
        return Buffer.from(bytes).toString(cs)
      } catch {
        return match
      }
    }
  )
}

/**
 * Parses a List-Unsubscribe header value into {mailto?, https?, http?}.
 * Header form: comma-separated <uri> entries; tolerates missing angle
 * brackets, folded whitespace, and stray spaces.
 */
export function parseListUnsubscribe(value) {
  const raw = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim()
  if (!raw) return null

  const uris = []
  const bracketed = raw.match(/<[^<>]+>/g)
  if (bracketed) {
    for (const b of bracketed) uris.push(b.slice(1, -1).trim())
  } else {
    // no angle brackets — split on commas and hope
    for (const part of raw.split(',')) {
      const p = part.trim()
      if (p) uris.push(p)
    }
  }

  const out = {}
  for (const uri of uris) {
    if (/^mailto:/i.test(uri) && !out.mailto) out.mailto = uri
    else if (/^https:\/\//i.test(uri) && !out.https) out.https = uri
    else if (/^http:\/\//i.test(uri) && !out.http) out.http = uri
  }
  return Object.keys(out).length ? out : null
}

/** RFC 8058: header must be exactly List-Unsubscribe=One-Click (case-insensitive). */
export function isOneClickPost(value) {
  return /^\s*List-Unsubscribe=One-Click\s*$/i.test(String(value ?? ''))
}

/**
 * Determines the unsubscribe capability of a single message from its headers.
 * Returns {method: 'oneclick'|'mailto'|'link'|'none', oneClickUrl?, mailtoUri?, linkUrl?}
 */
export function unsubscribeInfo(headers) {
  try {
    const lu = parseListUnsubscribe(headers['list-unsubscribe'])
    if (!lu) return { method: 'none' }

    const info = { method: 'none' }
    if (lu.mailto) info.mailtoUri = lu.mailto
    const link = lu.https || lu.http
    if (link) info.linkUrl = link

    if (lu.https && isOneClickPost(headers['list-unsubscribe-post'])) {
      info.method = 'oneclick'
      info.oneClickUrl = lu.https
    } else if (lu.mailto) {
      info.method = 'mailto'
    } else if (link) {
      info.method = 'link'
    }
    return info
  } catch {
    return { method: 'none' }
  }
}

export const METHOD_RANK = { oneclick: 3, mailto: 2, link: 1, none: 0 }
