import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import type { StorageStats } from '../types'

function parseFromHeader(from: string): string {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<.*>$/)
  return (m && m[1].trim()) || from
}

export default function StorageTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await api.storageStats()
      setStats(s)
    } catch (err) {
      handleApiError(err)
    } finally {
      setLoading(false)
    }
  }, [handleApiError])

  useEffect(() => { load() }, [load])

  const refresh = async () => {
    try {
      await api.storageRefresh()
      await load()
    } catch (err) {
      handleApiError(err)
    }
  }

  if (loading) {
    return <div className="hint">Analyzing your largest emails… this can take a moment.</div>
  }

  if (error) {
    return <div className="banner banner-error">{error}</div>
  }

  if (!stats) return null

  const maxSenderMB = Math.max(1, ...stats.senders.map(s => s.totalMB))
  const maxMonthMB = Math.max(1, ...stats.months.map(m => m.totalMB))

  return (
    <div>
      <div className="storage-toolbar">
        <p className="hint">
          Storage analysis covers every email larger than 1 MB (outside Trash and Spam). Cached for
          5 minutes.
        </p>
        <button className="btn btn-small" onClick={refresh}>Refresh</button>
      </div>

      <div className="storage-dashboard">
        <div className="storage-card">
          <h3>Reclaimable storage</h3>
          <div className="storage-big-number">{stats.totalMB.toLocaleString()} MB</div>
          <div className="storage-big-sub">
            across {stats.messageCount.toLocaleString()} large emails
          </div>
        </div>

        <div className="storage-card">
          <h3>Top senders by size</h3>
          {stats.senders.length === 0 && <div className="hint">No large emails found.</div>}
          <div className="storage-bar-chart">
            {stats.senders.map((s) => (
              <div className="storage-bar" key={s.email} title={`${s.email} — ${s.messageCount} emails`}>
                <span className="storage-bar-label">{parseFromHeader(s.name)}</span>
                <span
                  className="storage-bar-fill"
                  style={{ width: `${Math.max(4, (s.totalMB / maxSenderMB) * 140)}px` }}
                />
                <span className="storage-bar-value">{s.totalMB.toLocaleString()} MB</span>
              </div>
            ))}
          </div>
        </div>

        <div className="storage-card">
          <h3>Storage by month</h3>
          {stats.months.length === 0 && <div className="hint">No large emails found.</div>}
          <div className="storage-bar-chart">
            {stats.months.map((m) => (
              <div className="storage-bar" key={m.month} title={`${m.messageCount} emails`}>
                <span className="storage-bar-label">{m.month}</span>
                <span
                  className="storage-bar-fill"
                  style={{ width: `${Math.max(4, (m.totalMB / maxMonthMB) * 140)}px` }}
                />
                <span className="storage-bar-value">{m.totalMB.toLocaleString()} MB</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="all-labels">
        <h2 className="section-title">Largest attachments (&gt;5 MB)</h2>
        {stats.attachments.length === 0 && (
          <div className="hint">No attachments larger than 5 MB found.</div>
        )}
        {stats.attachments.length > 0 && (
          <div className="table-card">
            <table className="sender-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Subject</th>
                  <th className="num">Size</th>
                  <th className="num">Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.attachments.map((a) => (
                  <tr key={a.id}>
                    <td><span className="message-from">{parseFromHeader(a.from)}</span></td>
                    <td>{a.subject || '(no subject)'}</td>
                    <td className="num">{a.sizeMB.toLocaleString()} MB</td>
                    <td className="num">
                      {new Date(a.date).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
