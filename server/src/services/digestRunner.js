import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'
import { config } from '../config.js'
import { scanSenders } from './scanService.js'
import { diffNewSenders, buildDigestHtml, buildDigestText, buildDigestEmail } from './digestService.js'
import { getState, getSettings, recordRun } from '../store/digestStore.js'

async function getAccountEmail(gmail) {
  const profile = await limited(() => gmail.users.getProfile({ userId: 'me' }))
  return profile.data.emailAddress
}

/**
 * Scan and compute the new marketing senders vs. the persisted baseline,
 * without sending anything. `seeding` is true on the first-ever run (empty
 * baseline) — the client should explain that the run seeds a baseline rather
 * than emailing a giant list.
 */
export async function computeDigest(userId, { range = '6m' } = {}, emit) {
  return withAuthErrorHandling(async () => {
    emit?.({ phase: 'scanning' })
    const scan = await scanSenders(userId, { range }, (p) => emit?.({ phase: 'scanning', ...p }))
    const state = getState(userId)
    const seeding = !state.lastRunAt && state.baseline.knownSenders.length === 0
    const senders = [...scan.senders.values()]
    const newSenders = diffNewSenders(senders, state.baseline.knownSenders)
    const gmail = await getGmail(userId)
    const accountEmail = await getAccountEmail(gmail)
    return {
      seeding,
      newSenders,
      accountEmail,
      totalScanned: scan.messageCount,
    }
  }, userId)
}

/**
 * Digest job runner. On the first run it silently seeds the baseline (so you
 * are only ever alerted about senders that appear AFTER you start). On later
 * runs it emails a digest of new marketing senders and advances the baseline.
 *
 * dryRun:true computes + returns without sending or mutating state (preview).
 */
export async function runDigest(userId, { range = '6m', dryRun = false, at } = {}, emit) {
  return withAuthErrorHandling(async () => {
    const { seeding, newSenders, accountEmail, totalScanned } = await computeDigest(userId, { range }, emit)
    const settings = getSettings(userId)
    const recipient = settings.recipient || accountEmail
    const stamp = at || new Date().toISOString()

    if (dryRun) {
      return { dryRun: true, seeding, newSenders, recipient, totalScanned, sent: false }
    }

    // First run: seed the baseline from the current MARKETING senders (same
    // definition weekly runs use), send nothing. Seeding from marketing-only
    // avoids permanently suppressing a sender that later becomes marketing.
    if (seeding) {
      recordRun(userId, { at: stamp, reportedEmails: newSenders.map((s) => s.email), sent: false, recipient })
      return { dryRun: false, seeding: true, newSenders: [], recipient, totalScanned, sent: false }
    }

    // Advance durable state (lastRunAt + baseline) BEFORE sending. Sending is
    // at-least-once; persisting first makes the run at-most-once, so a crash or
    // retry after a successful send can never re-send the same digest.
    recordRun(userId, { at: stamp, reportedEmails: newSenders.map((s) => s.email), sent: newSenders.length > 0, recipient })

    let sent = false
    if (newSenders.length > 0) {
      emit?.({ phase: 'sending', to: recipient })
      const html = buildDigestHtml({ newSenders, accountEmail, appUrl: config.clientUrl, generatedAt: stamp })
      const text = buildDigestText({ newSenders, accountEmail, appUrl: config.clientUrl })
      const raw = buildDigestEmail({
        to: recipient,
        from: accountEmail,
        subject: `Your weekly inbox digest — ${newSenders.length} new marketing sender${newSenders.length === 1 ? '' : 's'}`,
        html,
        text,
      })
      const gmail = await getGmail(userId)
      await limited(() => gmail.users.messages.send({ userId: 'me', requestBody: { raw } }))
      sent = true
    }

    return { dryRun: false, seeding: false, newSenders, recipient, totalScanned, sent }
  }, userId)
}
