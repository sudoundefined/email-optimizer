import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import type { ProtectedSender } from '../types'

export default function ProtectedTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [list, setList] = useState<ProtectedSender[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.protectedList()
      setList(res.protected)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }, [onDisconnected])

  useEffect(() => { load() }, [load])

  const handleUnprotect = async (email: string) => {
    try {
      await api.unprotectSenders([email])
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (list === null && !error) return <div className="hint">Loading protected senders…</div>

  return (
    <div>
      {error && <div className="banner banner-error">{error}</div>}
      {list && list.length === 0 && (
        <div className="empty-state">
          <div className="empty-stamp" aria-hidden="true">🛡</div>
          <h2>No protected senders yet</h2>
          <p>Protect senders to exclude them from bulk unsubscribe and trash actions.
             Senders matching banks, utilities, and government agencies are auto-protected after each scan.</p>
        </div>
      )}
      {list && list.length > 0 && (
        <div className="table-card">
          <table className="sender-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Reason</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.email}>
                  <td><span className="sender-email" style={{ fontSize: '13px' }}>{p.email}</span></td>
                  <td>
                    {p.reason.startsWith('auto:') ? (
                      <span className="badge badge-blue">Auto</span>
                    ) : (
                      <span className="badge badge-gray">Manual</span>
                    )}
                  </td>
                  <td className="hint">
                    {new Date(p.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td>
                    <button className="btn btn-small btn-ghost" onClick={() => handleUnprotect(p.email)}>
                      Unprotect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
