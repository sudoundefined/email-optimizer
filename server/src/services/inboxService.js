import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'
import { getMetadata, listAllMessageIds } from '../gmail/messages.js'
import { trashMessages } from './messageTrashService.js'
import { listProtected } from './protectService.js'
import { parseFrom } from './headerParser.js'
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

/**
 * Run an arbitrary Gmail query and return recent messages.
 */
export async function filterMessages(query, max = 25) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
    const res = await limited(() =>
      gmail.users.messages.list({ userId: 'me', q: query, maxResults: max })
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

const FILTER_TRASH_MAX_MESSAGES = 10_000

/**
 * Allow-listed Gmail queries for the quick-filter toolbar.
 * Keep in sync with client/src/components/FilterToolbar.tsx FILTERS.
 * Bulk-trash only accepts these keys — never a raw client-supplied query.
 */
export const FILTERS = {
  'never-opened': 'is:unread older_than:6m -in:trash -in:spam',
  'low-engagement': 'is:unread older_than:3m -in:trash -in:spam',
  'unread-marketing': 'is:unread category:promotions -in:trash -in:spam',
  'unread-social': 'is:unread category:social -in:trash -in:spam',
  'old-newsletters': 'category:updates older_than:1y -in:trash -in:spam',
  'old-attachments': 'has:attachment older_than:1y -in:trash -in:spam',
  'large-emails': 'larger:5M -in:trash -in:spam',
  'stale-unread': 'is:unread older_than:6m -in:trash -in:spam',
  'old-promotions': 'category:promotions older_than:1y -in:trash -in:spam',
  'old-forums': 'category:forums older_than:1y -in:trash -in:spam',
}

/**
 * Trash EVERY message matching an allow-listed filter key (not just a sample).
 * Runs as a job. Gmail Trash only — never a permanent delete.
 *
 * Filters are content-scoped (e.g. "old attachments"), so they can sweep
 * protected senders (banks, government, etc.). Before trashing we fetch each
 * matched message's sender and drop any on the protect-list — upholding the
 * same guarantee the keep-latest and unsubscribe paths honor.
 *
 * Returns { trashed, excluded, capped } where `excluded` counts protected
 * messages skipped and `capped` indicates the 10k scan cap was hit.
 */
export async function trashByFilterKey(key, emit) {
  const q = FILTERS[key]
  if (!q) {
    const err = new Error(`Unknown filter "${key}"`)
    err.status = 400
    throw err
  }
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
    emit?.({ phase: 'listing', listed: 0 })
    // Fetch one past the cap purely to detect truncation honestly.
    const ids = await listAllMessageIds(gmail, q, {
      maxMessages: FILTER_TRASH_MAX_MESSAGES + 1,
      onProgress: (p) => emit?.({ phase: 'listing', ...p }),
    })
    const capped = ids.length > FILTER_TRASH_MAX_MESSAGES
    const scanIds = capped ? ids.slice(0, FILTER_TRASH_MAX_MESSAGES) : ids
    if (scanIds.length === 0) return { trashed: 0, excluded: 0, capped: false }

    let trashIds = scanIds
    let excluded = 0
    const protectedList = await listProtected()
    if (protectedList.length > 0) {
      const protectedSet = new Set(protectedList.map((p) => p.email.toLowerCase()))
      emit?.({ phase: 'checking', fetched: 0, total: scanIds.length })
      const meta = await getMetadata(gmail, scanIds, {
        onProgress: (p) => emit?.({ phase: 'checking', ...p }),
      })
      const allowed = []
      for (const m of meta) {
        const { email } = parseFrom(m.headers['from'])
        if (email && protectedSet.has(email.toLowerCase())) excluded++
        else allowed.push(m.id)
      }
      // getMetadata drops IDs whose fetch failed, so `allowed` only ever
      // contains messages whose sender we actually verified (fail-safe).
      trashIds = allowed
    }

    if (trashIds.length === 0) return { trashed: 0, excluded, capped }
    const res = await trashMessages(trashIds, emit)
    return { trashed: res.trashed, excluded, capped }
  })
}
