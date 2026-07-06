import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'
import { getMetadata } from '../gmail/messages.js'
import { listRegistered } from '../store/labelRegistry.js'

/**
 * Inbox groups. Label-backed groups report exact Gmail counts;
 * query-backed groups report Gmail's resultSizeEstimate (approx: true).
 */
export const GROUPS = [
  { key: 'important', title: 'Important', kind: 'label', labelId: 'IMPORTANT', blurb: 'What Gmail marked as important' },
  { key: 'primary', title: 'Primary', kind: 'label', labelId: 'CATEGORY_PERSONAL', blurb: 'Personal, person-to-person mail' },
  { key: 'marketing', title: 'Marketing', kind: 'label', labelId: 'CATEGORY_PROMOTIONS', blurb: 'Promotions, offers and deals' },
  { key: 'social', title: 'Social', kind: 'label', labelId: 'CATEGORY_SOCIAL', blurb: 'Social networks and communities' },
  { key: 'updates', title: 'Updates', kind: 'label', labelId: 'CATEGORY_UPDATES', blurb: 'Receipts, statements, notifications' },
  { key: 'forums', title: 'Forums', kind: 'label', labelId: 'CATEGORY_FORUMS', blurb: 'Mailing lists and discussion groups' },
  { key: 'starred', title: 'Starred', kind: 'label', labelId: 'STARRED', blurb: 'Everything you starred' },
  { key: 'unread', title: 'Unread', kind: 'label', labelId: 'UNREAD', blurb: 'All mail you have not opened' },
  { key: 'attachments', title: 'With attachments', kind: 'query', q: 'has:attachment -in:trash -in:spam', blurb: 'Mail carrying files' },
  { key: 'large', title: 'Large (>5 MB)', kind: 'query', q: 'larger:5M -in:trash -in:spam', blurb: 'The heaviest storage users' },
  { key: 'stale-unread', title: 'Stale unread (6 mo+)', kind: 'query', q: 'is:unread older_than:6m -in:trash -in:spam', blurb: 'Old mail you never opened' },
]

const groupByKey = new Map(GROUPS.map((g) => [g.key, g]))

export function getGroup(key) {
  return groupByKey.get(key) || null
}

/** Live counts for every group. */
export async function listGroups() {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
    return Promise.all(
      GROUPS.map((g) =>
        limited(async () => {
          if (g.kind === 'label') {
            const res = await gmail.users.labels.get({ userId: 'me', id: g.labelId })
            return {
              key: g.key,
              title: g.title,
              blurb: g.blurb,
              count: res.data.messagesTotal ?? 0,
              unread: res.data.messagesUnread ?? 0,
              approx: false,
            }
          }
          const res = await gmail.users.messages.list({ userId: 'me', q: g.q, maxResults: 1 })
          return {
            key: g.key,
            title: g.title,
            blurb: g.blurb,
            count: res.data.resultSizeEstimate ?? 0,
            unread: null,
            approx: true,
          }
        })
      )
    )
  })
}

/** The most recent messages in one group: {id, from, subject, date}[]. */
export async function groupMessages(key, max = 25) {
  const group = getGroup(key)
  if (!group) {
    const err = new Error(`Unknown group "${key}"`)
    err.status = 404
    throw err
  }
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
    const params =
      group.kind === 'label'
        ? { userId: 'me', labelIds: [group.labelId], maxResults: max }
        : { userId: 'me', q: group.q, maxResults: max }
    const res = await limited(() => gmail.users.messages.list(params))
    const ids = (res.data.messages || []).map((m) => m.id)
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

/** Every label in the Gmail account (system + user) with live counts. */
export async function listAllLabels() {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
    const registered = await listRegistered()
    const appIds = new Set(registered.map((r) => r.id))

    const listRes = await limited(() => gmail.users.labels.list({ userId: 'me' }))
    const labels = await Promise.all(
      (listRes.data.labels || []).map((l) =>
        limited(async () => {
          const res = await gmail.users.labels.get({ userId: 'me', id: l.id })
          return {
            id: res.data.id,
            name: res.data.name,
            type: res.data.type === 'system' ? 'system' : 'user',
            messagesTotal: res.data.messagesTotal ?? 0,
            messagesUnread: res.data.messagesUnread ?? 0,
            appCreated: appIds.has(res.data.id),
          }
        }).catch(() => null)
      )
    )

    return labels
      .filter(Boolean)
      .sort((a, b) =>
        a.type !== b.type ? (a.type === 'system' ? -1 : 1) : a.name.localeCompare(b.name)
      )
  })
}
