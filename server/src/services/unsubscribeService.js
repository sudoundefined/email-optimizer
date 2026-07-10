import net from 'node:net'
import dns from 'node:dns/promises'
import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { requireScan } from '../store/scanCache.js'
import { parseMailto, buildUnsubscribeEmail } from '../gmail/mime.js'
import { limited } from '../gmail/rateLimiter.js'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase()
    return low === '::1' || low.startsWith('fc') || low.startsWith('fd') || low.startsWith('fe80')
  }
  const parts = ip.split('.').map(Number)
  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

/** Rejects non-https URLs and hosts that resolve to private/loopback ranges. */
async function assertSafeUrl(rawUrl) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:') throw new Error('one-click URL must be https')
  const host = url.hostname
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('URL resolves to a private address')
    return
  }
  if (/^localhost$/i.test(host)) throw new Error('URL resolves to a private address')
  const { address } = await dns.lookup(host)
  if (isPrivateIp(address)) throw new Error('URL resolves to a private address')
}

async function oneClickPost(url) {
  await assertSafeUrl(url)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': BROWSER_UA,
    },
    body: 'List-Unsubscribe=One-Click',
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
