import { Router } from 'express'

/**
 * Public legal pages required for Google OAuth production verification.
 * These are intentionally unauthenticated and served as plain HTML so they
 * have stable public URLs (e.g. https://your-host/legal/privacy) that can be
 * entered on the OAuth consent screen. Update ORG/CONTACT before submitting.
 */

const router = Router()

const CONTACT_EMAIL = process.env.LEGAL_CONTACT_EMAIL || 'your-email@example.com'
const APP_NAME = 'Email Optimizer'
const UPDATED = '2026-07-09'

function page(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — ${APP_NAME}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1e293b; line-height: 1.6; }
  h1 { font-size: 24px; } h2 { font-size: 18px; margin-top: 28px; }
  code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; }
  .muted { color: #64748b; font-size: 13px; }
</style>
</head>
<body>
${bodyHtml}
<p class="muted">Last updated ${UPDATED}. Contact: ${CONTACT_EMAIL}</p>
</body>
</html>`
}

router.get('/legal/privacy', (req, res) => {
  res.type('html').send(
    page(
      'Privacy Policy',
      `<h1>${APP_NAME} — Privacy Policy</h1>
<p>${APP_NAME} is a self-hosted personal tool that helps you clean up your own Gmail
mailbox. It runs on infrastructure you control.</p>

<h2>What we access</h2>
<p>With your explicit Google consent, the app uses the Gmail API scopes
<code>gmail.modify</code> and <code>gmail.send</code> to: read message metadata
(sender, subject, labels, size) to group and analyze your mail; move messages to
Trash; apply or remove labels; and send unsubscribe or digest emails from your own
account on your behalf.</p>

<h2>What we store</h2>
<p>The app has no external database. OAuth tokens and small operational files
(created-label IDs, your protected-sender list, and weekly-digest settings/baseline)
are stored locally in the app's own <code>data</code> directory on the machine you
run it on. Email contents are never persisted; message metadata is processed in
memory and cached only transiently.</p>

<h2>What we share</h2>
<p>Nothing. The app does not transmit your data to any third party. Requests go only
to Google's Gmail API. Unsubscribe one-click requests go to the sender's own
unsubscribe endpoint (HTTPS only) when you choose to unsubscribe.</p>

<h2>Deletion &amp; revocation</h2>
<p>You can revoke access at any time from your
<a href="https://myaccount.google.com/permissions">Google Account permissions</a>
or by signing out in the app, which deletes the stored token. Deleting the app's
<code>data</code> directory removes all locally stored state.</p>

<h2>Limited use</h2>
<p>Use of information received from Google APIs adheres to the
<a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
including the Limited Use requirements.</p>`
    )
  )
})

router.get('/legal/terms', (req, res) => {
  res.type('html').send(
    page(
      'Terms of Service',
      `<h1>${APP_NAME} — Terms of Service</h1>
<p>${APP_NAME} is provided as-is, without warranty of any kind, for personal use in
managing your own email account.</p>

<h2>Acceptable use</h2>
<p>Use the app only with accounts you own or are authorized to manage. You are
responsible for the actions you take through it (unsubscribing, labeling, and moving
mail to Trash).</p>

<h2>No warranty / liability</h2>
<p>The software is provided "as is". To the maximum extent permitted by law, the
authors are not liable for any loss arising from its use. Actions move mail to Gmail
Trash (recoverable for 30 days); the app performs no permanent deletion.</p>

<h2>Changes</h2>
<p>These terms may be updated; the "last updated" date reflects the current version.</p>`
    )
  )
})

export default router
