import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'
import { config } from '../config.js'
import { scanSenders } from './scanService.js'
import { diffNewSenders, buildDigestHtml, buildDigestText, buildDigestEmail } from './digestService.js'
import { getState, getSettings, recordRun } from '../store/digestStore.js'

async function getUserEmail(gmail) {
  const profile = await limited(() => gmail.users.getProfile({ userId: 'me' }))
  return profile.data.emailAddress
}

/**
 * Scan and compute the new marketing senders vs. the persisted baseline, without sending anything.
 */
export async function computeDigest(userId, { range = '6m' } = {}, emit) {
  return withAuthErrorHandling(async () => {
    emit?.({ phase: 'scanning' })
    const scan = await scanSenders(userId, { range }, (p) => emit?.({ phase: 'scanning', ...p }))
    const state = await getState(userId)
    const seeding = !state.lastRunAt && state.baseline.knownSenders.length === 0
    const senders = [...scan.senders.values()]
    const newSenders = diffNewSenders(senders, state.baseline.knownSenders)
    const gmail = await getGmail(userId)
    const userEmail = await getUserEmail(gmail)
    return {
      seeding,
      newSenders,
      userEmail,
      accountEmail: userEmail,
      totalScanned: scan.messageCount,
    }
  }, userId)
}

/**
 * Digest job runner.
 */
export async function runDigest(userId, { range = '6m', dryRun = false, at } = {}, emit) {
  return withAuthErrorHandling(async () => {
    const { seeding, newSenders, userEmail, totalScanned } = await computeDigest(userId, { range }, emit)
    const settings = await getSettings(userId)
    const recipient = settings.recipient || userEmail
    const stamp = at || new Date().toISOString()

    if (dryRun) {
      return { dryRun: true, seeding, newSenders, recipient, totalScanned, sent: false }
    }

    if (seeding) {
      await recordRun(userId, { at: stamp, reportedEmails: newSenders.map((s) => s.email), sent: false, recipient })
      return { dryRun: false, seeding: true, newSenders: [], recipient, totalScanned, sent: false }
    }

    await recordRun(userId, { at: stamp, reportedEmails: newSenders.map((s) => s.email), sent: newSenders.length > 0, recipient })

    let sent = false
    if (newSenders.length > 0) {
      emit?.({ phase: 'sending', to: recipient })
      const html = buildDigestHtml({ newSenders, accountEmail: userEmail, appUrl: config.clientUrl, generatedAt: stamp })
      const text = buildDigestText({ newSenders, accountEmail: userEmail, appUrl: config.clientUrl })
      const raw = buildDigestEmail({
        to: recipient,
        from: userEmail,
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
