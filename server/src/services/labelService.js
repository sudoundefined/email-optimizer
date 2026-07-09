import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'
import { requireScan } from '../store/scanCache.js'
import { listRegistered, registerLabel, unregisterLabel } from '../store/labelRegistry.js'
import { config } from '../config.js'
import { getMetadata } from '../gmail/messages.js'

const BATCH_MODIFY_MAX = 1000

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function ensureLabel(gmail, name, existingByName) {
  const found = existingByName.get(name.toLowerCase())
  if (found) {
    await registerLabel({ id: found.id, name: found.name })
    return found.id
  }
  const res = await limited(() =>
    gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    })
  )
  await registerLabel({ id: res.data.id, name: res.data.name })
  return res.data.id
}

/**
 * Job runner: create labels as needed and apply them to all scanned
 * messages of the assigned senders.
 * assignments: [{senderEmail, labelName}] — labelName without prefix.
 */
export async function runApplyLabels({ assignments }, emit) {
  return withAuthErrorHandling(async () => {
    const scan = requireScan()
    const gmail = await getGmail()

    const labelsRes = await limited(() => gmail.users.labels.list({ userId: 'me' }))
    const existingByName = new Map(
      (labelsRes.data.labels || []).map((l) => [l.name.toLowerCase(), l])
    )

    // group message ids per label
    const idsByLabel = new Map()
    for (const { senderEmail, labelName } of assignments) {
      const sender = scan.senders.get(String(senderEmail).toLowerCase())
      if (!sender || !labelName) continue
      const fullName = labelName.startsWith(config.labelPrefix)
        ? labelName
        : config.labelPrefix + labelName
      if (!idsByLabel.has(fullName)) idsByLabel.set(fullName, [])
      idsByLabel.get(fullName).push(...sender.messageIds)
    }

    const totalMessages = [...idsByLabel.values()].reduce((n, ids) => n + ids.length, 0)
    let labeled = 0
    const applied = []

    for (const [fullName, ids] of idsByLabel) {
      const labelId = await ensureLabel(gmail, fullName, existingByName)
      for (const ids1000 of chunk([...new Set(ids)], BATCH_MODIFY_MAX)) {
        await limited(() =>
          gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: { ids: ids1000, addLabelIds: [labelId] },
          })
        )
        labeled += ids1000.length
        emit({ phase: 'labeling', labeled, total: totalMessages, currentLabel: fullName })
      }
      applied.push({ label: fullName, messages: new Set(ids).size })
    }

    return { applied, totalMessages }
  })
}

/** Lists app-created labels with live counts; prunes registry entries deleted externally. */
export async function listAppLabels() {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
    const registered = await listRegistered()
    const out = []
    for (const entry of registered) {
      try {
        const res = await limited(() => gmail.users.labels.get({ userId: 'me', id: entry.id }))
        out.push({
          id: res.data.id,
          name: res.data.name,
          messagesTotal: res.data.messagesTotal ?? 0,
          messagesUnread: res.data.messagesUnread ?? 0,
        })
      } catch (err) {
        if (err?.code === 404 || err?.response?.status === 404) {
          await unregisterLabel(entry.id)
        } else {
          throw err
        }
      }
    }
    return out
  })
}

/** Deletes only the label; Gmail removes it from all messages, emails are kept. */
export async function deleteLabelOnly(labelId) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
    try {
      await limited(() => gmail.users.labels.delete({ userId: 'me', id: labelId }))
    } catch (err) {
      if (err?.code !== 404 && err?.response?.status !== 404) throw err
    }
    await unregisterLabel(labelId)
  })
}

/**
 * Job runner: move every message carrying the label to Trash, then
 * delete the label. Uses batchModify with the TRASH system label —
 * recoverable for 30 days; never permanent delete.
 */
export async function runTrashLabel({ labelId }, emit) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()

    const allIds = []
    let pageToken
    emit({ phase: 'collecting', collected: 0 })
    do {
      const res = await limited(() =>
        gmail.users.messages.list({
          userId: 'me',
          labelIds: [labelId],
          maxResults: 500,
          pageToken,
        })
      )
      for (const m of res.data.messages || []) allIds.push(m.id)
      pageToken = res.data.nextPageToken
      emit({ phase: 'collecting', collected: allIds.length })
    } while (pageToken)

    let trashed = 0
    for (const ids1000 of chunk(allIds, BATCH_MODIFY_MAX)) {
      await limited(() =>
        gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: ids1000,
            addLabelIds: ['TRASH'],
            removeLabelIds: ['INBOX', labelId],
          },
        })
      )
      trashed += ids1000.length
      emit({ phase: 'trashing', trashed, total: allIds.length })
    }

    await deleteLabelOnly(labelId)
    return { trashed: allIds.length }
  })
}

/** Fetches recent messages for a specific label ID */
export async function getLabelMessages(labelId, max = 25) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
    const res = await limited(() =>
      gmail.users.messages.list({ userId: 'me', labelIds: [labelId], maxResults: max })
    )
    const ids = (res.data.messages || []).map((m) => m.id)
    if (ids.length === 0) return []
    const messages = await getMetadata(gmail, ids, {})
    return messages
      .sort((a, b) => b.internalDate - a.internalDate)
      .map((m) => ({
        id: m.id,
        from: m.headers['from'] || '',
        subject: m.headers['subject'] || '',
        date: m.internalDate,
      }))
  })
}
