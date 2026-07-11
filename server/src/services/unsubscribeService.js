import net from 'node:net'
import dns from 'node:dns/promises'
import https from 'node:https'
import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { requireScan } from '../store/scanCache.js'
import { parseMailto, buildUnsubscribeEmail } from '../gmail/mime.js'
import { limited } from '../gmail/rateLimiter.js'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return true
  const low = ip.toLowerCase()
  if (net.isIPv6(ip)) {
    if (low === '::1' || low === '::' || low.startsWith('fc') || low.startsWith('fd') || low.startsWith('fe80')) {
      return true
    }
    if (low.startsWith('::ffff:')) {
      const v4Part = low.slice(7)
      if (net.isIPv4(v4Part)) {
        return isPrivateIp(v4Part)
      }
    }
    return false
  }
  const parts = ip.split('.').map(Number)
  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

/**
 * Rejects non-https URLs and hosts that resolve to private/loopback ranges.
 * Returns the validated `{ address, family }` (the literal itself for IP-literal
 * hosts) so the caller can pin the actual TCP connection to this exact address
 * instead of letting the HTTP client re-resolve the hostname later — re-resolving
 * is what opens the DNS-rebinding TOCTOU window (see M1 in the security report).
 */
export async function assertSafeUrl(rawUrl) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:') throw new Error('one-click URL must be https')
  const host = url.hostname
  const literalFamily = net.isIP(host)
  if (literalFamily) {
    if (isPrivateIp(host)) throw new Error('URL resolves to a private address')
    return { address: host, family: literalFamily }
  }
  if (/^localhost$/i.test(host)) throw new Error('URL resolves to a private address')
  const { address, family } = await dns.lookup(host)
  if (isPrivateIp(address)) throw new Error('URL resolves to a private address')
  return { address, family }
}

/**
 * Builds a `dns.lookup`-shaped resolver that always answers with the single,
 * already-validated `address`/`family` — used as the `lookup` option on an
 * outbound request so the socket can only ever connect to the address
 * `assertSafeUrl` checked, regardless of what the hostname resolves to by the
 * time the connection is actually opened. `options.all` is honored because
 * Node's happy-eyeballs connect logic requests the array form.
 * Defense in depth: re-checks `isPrivateIp` here too, in case this is ever
 * called with an address that skipped `assertSafeUrl`.
 */
export function pinnedLookup(address, family) {
  return (hostname, options, callback) => {
    if (isPrivateIp(address)) {
      callback(new Error('URL resolves to a private address'))
      return
    }
    if (options && options.all) {
      callback(null, [{ address, family }])
    } else {
      callback(null, address, family)
    }
  }
}

/**
 * POSTs the one-click body with the connection pinned to `address`/`family`.
 * `hostname` (from the URL) is still what's sent as the Host header and used
 * for TLS SNI/certificate verification — only the DNS resolution step is
 * overridden, so this doesn't affect which cert the server needs to present.
 */
function pinnedHttpsPost(targetUrl, address, family) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl)
    const body = 'List-Unsubscribe=One-Click'
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': BROWSER_UA,
        },
        lookup: pinnedLookup(address, family),
        // Don't pool/reuse keep-alive sockets across hosts: each call gets its own
        // freshly-validated connection instead of possibly reusing one opened for
        // a different pinned address under the same hostname:port pool key.
        agent: false,
        signal: AbortSignal.timeout(10_000),
      },
      (res) => {
        res.resume() // discard the body, same intent as the previous res.body?.cancel()
        resolve({ status: res.statusCode, location: res.headers.location })
      }
    )
    req.on('error', reject)
    req.end(body)
  })
}

async function oneClickPost(url) {
  let currentUrl = url
  for (let hop = 0; hop < 5; hop++) {
    const { address, family } = await assertSafeUrl(currentUrl)
    const res = await pinnedHttpsPost(currentUrl, address, family)
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new Error(`HTTP ${res.status} redirect without location`)
      currentUrl = new URL(res.location, currentUrl).toString()
      continue
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`)
    return
  }
  throw new Error('Too many redirects')
}

async function sendMailtoUnsubscribe(gmail, mailtoUri) {
  const parsed = parseMailto(mailtoUri)
  if (!parsed) throw new Error('unparseable mailto link')
  const raw = buildUnsubscribeEmail(parsed)
  await limited(() => gmail.users.messages.send({ userId: 'me', requestBody: { raw } }))
}

/**
 * Attempts unsubscribe for one sender, degrading oneclick → mailto → manual.
 * Returns {sender, method, status: 'success'|'manual'|'failed', detail, manualUrl?}
 */
export async function unsubscribeSender(gmail, sender) {
  const info = sender.unsubscribe || { method: 'none' }
  const base = { sender: sender.email, method: info.method }

  if (info.method === 'oneclick') {
    try {
      await oneClickPost(info.oneClickUrl)
      return { ...base, status: 'success', detail: 'One-click unsubscribe accepted' }
    } catch (err) {
      if (info.mailtoUri) {
        try {
          await sendMailtoUnsubscribe(gmail, info.mailtoUri)
          return {
            ...base,
            method: 'mailto',
            status: 'success',
            detail: `One-click failed (${err.message}); unsubscribe email sent instead`,
          }
        } catch (mailErr) {
          return { ...base, status: 'failed', detail: `One-click and mailto both failed: ${mailErr.message}`, manualUrl: info.linkUrl }
        }
      }
      if (info.linkUrl) {
        return { ...base, status: 'manual', detail: `One-click failed (${err.message}) — link may be stale; open it to unsubscribe`, manualUrl: info.linkUrl }
      }
      return { ...base, status: 'failed', detail: `One-click failed: ${err.message}` }
    }
  }

  if (info.method === 'mailto') {
    try {
      await sendMailtoUnsubscribe(gmail, info.mailtoUri)
      return { ...base, status: 'success', detail: 'Unsubscribe email sent (senders may take days to honor it)' }
    } catch (err) {
      if (info.linkUrl) {
        return { ...base, status: 'manual', detail: `Mailto failed (${err.message}); open the link to unsubscribe`, manualUrl: info.linkUrl }
      }
      return { ...base, status: 'failed', detail: `Mailto failed: ${err.message}` }
    }
  }

  if (info.method === 'link') {
    return { ...base, status: 'manual', detail: 'Open the unsubscribe page to confirm', manualUrl: info.linkUrl }
  }

  return { ...base, status: 'failed', detail: 'No unsubscribe method available' }
}

/** Job runner: unsubscribe from the given sender emails with concurrency 4. */
export async function runUnsubscribe(userId, { senderEmails }, emit) {
  return withAuthErrorHandling(async () => {
    const scan = requireScan(userId)
    const gmail = await getGmail(userId)

    const senders = senderEmails
      .map((e) => scan.senders.get(String(e).toLowerCase()))
      .filter(Boolean)

    const results = []
    let done = 0
    const CONCURRENCY = 4
    const queue = [...senders]

    async function worker() {
      for (;;) {
        const sender = queue.shift()
        if (!sender) return
        const result = await unsubscribeSender(gmail, sender).catch((err) => ({
          sender: sender.email,
          method: sender.unsubscribe?.method || 'none',
          status: 'failed',
          detail: err?.message || String(err),
        }))
        results.push(result)
        done++
        emit({ done, total: senders.length, latest: result, results: [...results] })
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, senders.length) }, worker))

    const summary = {
      total: senders.length,
      success: results.filter((r) => r.status === 'success').length,
      manual: results.filter((r) => r.status === 'manual').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    }
    return summary
  }, userId)
}
