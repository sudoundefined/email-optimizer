import crypto from 'node:crypto'
import { base64url, sanitizeHeaderValue } from '../gmail/mime.js'

/**
 * Pure builders for the weekly digest. The job runner (digest job) wires these
 * to a live scan + Gmail send; everything here is deterministic and unit-tested.
 */

const METHOD_LABEL = {
  oneclick: 'One-click',
  mailto: 'Email',
  link: 'Link',
  none: 'None',
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

/**
 * Given raw scan sender objects and the set of already-known sender emails,
 * return the NEW marketing senders (not seen before) as a lightweight view,
 * sorted by message count desc.
 *
 * A "marketing" sender is one with an actual unsubscribe method
 * (method !== 'none'); pass marketingOnly:false to include all new senders.
 */
export function diffNewSenders(senders, knownEmails, { marketingOnly = true } = {}) {
  const known = new Set([...(knownEmails || [])].map((e) => String(e).toLowerCase()))
  const out = []
  for (const s of senders || []) {
    const email = String(s.email || '').toLowerCase()
    if (!email || known.has(email)) continue
    const info = s.unsubscribe || { method: 'none' }
    if (marketingOnly && info.method === 'none') continue
    out.push({
      email: s.email,
      name: s.name || s.email,
      messageCount: s.messageCount || 0,
      method: info.method || 'none',
      // A human-openable https URL when one exists (browser link or one-click GET page).
      unsubUrl: info.linkUrl || info.oneClickUrl || null,
    })
  }
  return out.sort((a, b) => b.messageCount - a.messageCount)
}

/** HTML body for the digest email. All dynamic values are escaped. */
export function buildDigestHtml({ newSenders = [], accountEmail = '', appUrl = '', generatedAt = '' } = {}) {
  const dateStr = generatedAt ? escapeHtml(generatedAt) : ''
  const rows = newSenders
    .map((s) => {
      const name = escapeHtml(s.name)
      const email = escapeHtml(s.email)
      const count = escapeHtml(String(s.messageCount))
      const methodLabel = escapeHtml(METHOD_LABEL[s.method] || s.method)
      const action = s.unsubUrl
        ? `<a href="${escapeHtml(s.unsubUrl)}" style="color:#2563eb;text-decoration:none;font-weight:600">Unsubscribe</a>`
        : `<span style="color:#64748b">${methodLabel}</span>`
      return `<tr>
  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">
    <div style="font-weight:600;color:#1e293b">${name}</div>
    <div style="font-size:12px;color:#64748b">${email}</div>
  </td>
  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#1e293b">${count}</td>
  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${action}</td>
</tr>`
    })
    .join('\n')

  const appLink = appUrl
    ? `<p style="margin:16px 0 0"><a href="${escapeHtml(appUrl)}" style="color:#2563eb">Open Email Optimizer</a> to unsubscribe or trash in bulk.</p>`
    : ''

  return `<!doctype html>
<html>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#1e293b;margin:0 0 4px">Your weekly inbox digest</h1>
    <p style="color:#64748b;margin:0 0 16px">
      ${newSenders.length} new marketing sender${newSenders.length === 1 ? '' : 's'} started emailing
      ${accountEmail ? escapeHtml(accountEmail) : 'you'}${dateStr ? ` · ${dateStr}` : ''}.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Sender</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Emails</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Action</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
    ${appLink}
    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0">Sent by Email Optimizer, running on your own machine. Reply-to-unsubscribe senders show their method instead of a link.</p>
  </div>
</body>
</html>`
}

/** Plain-text alternative body. */
export function buildDigestText({ newSenders = [], accountEmail = '', appUrl = '' } = {}) {
  const lines = [
    `Your weekly inbox digest`,
    `${newSenders.length} new marketing sender(s) started emailing ${accountEmail || 'you'}.`,
    '',
  ]
  for (const s of newSenders) {
    const action = s.unsubUrl ? `unsubscribe: ${s.unsubUrl}` : `method: ${METHOD_LABEL[s.method] || s.method}`
    lines.push(`- ${s.name} <${s.email}> — ${s.messageCount} emails — ${action}`)
  }
  if (appUrl) {
    lines.push('', `Open Email Optimizer to unsubscribe or trash in bulk: ${appUrl}`)
  }
  return lines.join('\n')
}

/**
 * Build a raw RFC 2822 multipart/alternative message, base64url-encoded for
 * gmail.users.messages.send. Headers are CRLF-sanitized against injection.
 */
export function buildDigestEmail({ to, from, subject, html, text }) {
  const boundary = `=_dg_${crypto.randomBytes(12).toString('hex')}`
  const headers = [
    `From: ${sanitizeHeaderValue(from)}`,
    `To: ${sanitizeHeaderValue(to)}`,
    `Subject: ${sanitizeHeaderValue(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    text || '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    html || '',
    `--${boundary}--`,
    '',
  ]
  return base64url([...headers, '', ...body].join('\r\n'))
}
