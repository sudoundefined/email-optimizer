import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import type { GmailLabel, GroupMessage, InboxGroup } from '../types'

/** CATEGORY_FORUMS → "Category: Forums", INBOX → "Inbox" */
function prettyLabelName(l: GmailLabel): string {
  if (l.type !== 'system') return l.name
  return l.name
    .toLowerCase()
    .replace(/^category_/, 'category: ')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function parseFromHeader(from: string): string {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<.*>$/)
  return (m && m[1].trim()) || from
}

export default function InboxTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [groups, setGroups] = useState<InboxGroup[] | null>(null)
  const [labels, setLabels] = useState<GmailLabel[] | null>(null)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [messages, setMessages] = useState<GroupMessage[] | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [g, l] = await Promise.all([api.inboxGroups(), api.allLabels()])
        if (!cancelled) {
          setGroups(g)
          setLabels(l)
        }
      } catch (err) {
        if (!cancelled) handleApiError(err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [handleApiError])

  const toggleGroup = async (key: string) => {
    if (openGroup === key) {
      setOpenGroup(null)
      setMessages(null)
      return
    }
    setOpenGroup(key)
    setMessages(null)
    setMessagesLoading(true)
    try {
      const msgs = await api.groupMessages(key)
      setMessages(msgs)
    } catch (err) {
      handleApiError(err)
      setOpenGroup(null)
    } finally {
      setMessagesLoading(false)
    }
  }

  const openTitle = groups?.find((g) => g.key === openGroup)?.title

  return (
    <div>
      {error && <div className="banner banner-error">{error}</div>}

      {groups === null && !error && <div className="hint">Reading your inbox…</div>}

      {groups && (
        <div className="pigeonholes">
          {groups.map((g) => (
            <button
              key={g.key}
              className={openGroup === g.key ? 'hole hole-open' : 'hole'}
              onClick={() => toggleGroup(g.key)}
              title={g.blurb}
            >
              <span className="hole-title">{g.title}</span>
              <span className="hole-count">
                {g.approx && <span className="hole-approx">≈</span>}
                {g.count.toLocaleString()}
              </span>
              <span className="hole-sub">
                {g.unread !== null && g.unread > 0
                  ? `${g.unread.toLocaleString()} unread`
                  : g.blurb}
              </span>
            </button>
          ))}
        </div>
      )}

      {openGroup && (
        <div className="group-messages">
          <div className="group-messages-header">
            <span>Latest in {openTitle}</span>
            <button className="btn btn-small btn-ghost" onClick={() => toggleGroup(openGroup)}>
              Close
            </button>
          </div>
          {messagesLoading && <div className="hint">Loading messages…</div>}
          {messages && messages.length === 0 && <div className="hint">No messages in this group.</div>}
          {messages && messages.length > 0 && (
            <ul className="message-list">
              {messages.map((m) => (
                <li key={m.id} className="message-row">
                  <span className="message-from">{parseFromHeader(m.from)}</span>
                  <span className="message-subject">{m.subject || '(no subject)'}</span>
                  <span className="message-date">
                    {new Date(m.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {labels && (
        <section className="all-labels">
          <h2 className="section-title">All Gmail labels</h2>
          <p className="hint">
            Every label in your account — Gmail's built-in system labels, your own, and the ones this
            app created (managed on the Labels tab).
          </p>
          <div className="table-card">
            <table className="sender-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Type</th>
                  <th className="num">Emails</th>
                  <th className="num">Unread</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span className="label-name">{prettyLabelName(l)}</span>
                    </td>
                    <td>
                      {l.appCreated ? (
                        <span className="badge badge-green">App</span>
                      ) : l.type === 'system' ? (
                        <span className="badge badge-gray">System</span>
                      ) : (
                        <span className="badge badge-blue">User</span>
                      )}
                    </td>
                    <td className="num">{l.messagesTotal.toLocaleString()}</td>
                    <td className="num">{l.messagesUnread.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
