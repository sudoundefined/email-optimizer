import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'
import { getMetadata, listAllMessageIds, listMessagesPaginated } from '../gmail/messages.js'
import { trashMessages } from './messageTrashService.js'
import { listProtected } from './protectService.js'
import { parseFrom } from './headerParser.js'
import { listRegistered } from '../store/labelRegistry.js'
import { LIST_LIMITS } from '../utils/constants.js'
import { getEffectiveScanLimits } from '../utils/preferences.js'

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

export async function listGroups(userId) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail(userId)
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
  }, userId)
}

export async function groupMessages(userId, key, max = LIST_LIMITS.MESSAGES_DEFAULT) {
  const group = getGroup(key)
  if (!group) {
    const err = new Error(`Unknown group "${key}"`)
    err.status = 404
    throw err
  }
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail(userId)
    const ids = await listMessagesPaginated(gmail, {
      ...(group.kind === 'label' ? { labelIds: [group.labelId] } : { q: group.q }),
      maxMessages: max,
    })
    const messages = await getMetadata(gmail, ids, {})
    return messages
      .sort((a, b) => b.internalDate - a.internalDate)
      .map((m) => ({
        id: m.id,
        from: m.headers['from'] || '',
        subject: m.headers['subject'] || '',
        date: m.internalDate,
      }))
  }, userId)
}

export async function listAllLabels(userId) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail(userId)
    const registered = await listRegistered(userId)
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
  }, userId)
}

export async function filterMessages(userId, query, max = LIST_LIMITS.MESSAGES_DEFAULT) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail(userId)
    const ids = await listMessagesPaginated(gmail, { q: query, maxMessages: max })
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
  }, userId)
}

const FILTER_TRASH_MAX_MESSAGES = 10_000

export const FILTER_DEFS = [
  { key: 'never-opened', label: 'Never opened', query: 'is:unread older_than:6m -in:trash -in:spam', category: 'engagement' },
  { key: 'low-engagement', label: 'Rarely read', query: 'is:unread older_than:3m -in:trash -in:spam', category: 'engagement' },
  { key: 'unread-marketing', label: 'Unread marketing', query: 'is:unread category:promotions -in:trash -in:spam', category: 'category' },
  { key: 'unread-social', label: 'Unread social', query: 'is:unread category:social -in:trash -in:spam', category: 'category' },
  { key: 'old-newsletters', label: 'Old newsletters', query: 'category:updates older_than:1y -in:trash -in:spam', category: 'category' },
  { key: 'old-attachments', label: 'Old with attachments', query: 'has:attachment older_than:1y -in:trash -in:spam', category: 'cleanup' },
  { key: 'large-emails', label: 'Large (>5 MB)', query: 'larger:5M -in:trash -in:spam', category: 'cleanup' },
  { key: 'stale-unread', label: 'Unread 6 mo+', query: 'is:unread older_than:6m -in:trash -in:spam', category: 'cleanup' },
  { key: 'old-promotions', label: 'Old promotions', query: 'category:promotions older_than:1y -in:trash -in:spam', category: 'cleanup' },
  { key: 'old-forums', label: 'Old forums', query: 'category:forums older_than:1y -in:trash -in:spam', category: 'category' },
]

export const FILTERS = Object.fromEntries(FILTER_DEFS.map((d) => [d.key, d.query]))

export async function trashByFilterKey(userId, key, emit) {
  const q = FILTERS[key]
  if (!q) {
    const err = new Error(`Unknown filter "${key}"`)
    err.status = 400
    throw err
  }
  return withAuthErrorHandling(async () => {
    const limits = await getEffectiveScanLimits(userId)
    const maxTrashLimit = limits.maxMessages
    const gmail = await getGmail(userId)
    emit?.({ phase: 'listing', listed: 0 })
    const ids = await listAllMessageIds(gmail, q, {
      maxMessages: maxTrashLimit + 1,
      userId,
      onProgress: (p) => emit?.({ phase: 'listing', ...p }),
    })
    const capped = ids.length > maxTrashLimit
    const scanIds = capped ? ids.slice(0, maxTrashLimit) : ids
    if (scanIds.length === 0) return { trashed: 0, excluded: 0, capped: false }

    let trashIds = scanIds
    let excluded = 0
    const protectedList = await listProtected(userId)
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
      trashIds = allowed
    }

    if (trashIds.length === 0) return { trashed: 0, excluded, capped }
    const res = await trashMessages(userId, trashIds, emit)
    return { trashed: res.trashed, excluded, capped }
  }, userId)
}
