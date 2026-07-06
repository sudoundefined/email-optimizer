import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import type { AppLabel } from '../types'
import { useJob } from '../hooks/useJob'
import ConfirmDialog from './ConfirmDialog'

export default function LabelManager({ onDisconnected }: { onDisconnected: () => void }) {
  const [labels, setLabels] = useState<AppLabel[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ label: AppLabel; mode: 'labelOnly' | 'trashEmails' } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const trashJob = useJob()

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const load = useCallback(async () => {
    try {
      setLabels(await api.labels())
    } catch (err) {
      handleApiError(err)
    }
  }, [handleApiError])

  useEffect(() => {
    load()
  }, [load])

  const execute = async () => {
    if (!confirm) return
    const { label, mode } = confirm
    setConfirm(null)
    setError(null)
    setBusyId(label.id)
    try {
      if (mode === 'labelOnly') {
        await api.deleteLabelOnly(label.id)
      } else {
        const snapshot = await trashJob.start(() => api.trashLabel(label.id))
        if (snapshot.state === 'error') setError(snapshot.error || 'Trashing failed')
      }
      await load()
    } catch (err) {
      handleApiError(err)
    } finally {
      setBusyId(null)
    }
  }

  const progress = trashJob.job?.progress as
    | { phase?: string; collected?: number; trashed?: number; total?: number }
    | null

  if (labels === null && !error) return <div className="hint">Loading labels…</div>

  return (
    <div>
      {error && <div className="banner banner-error">{error}</div>}
      {trashJob.running && progress && (
        <div className="progress-panel">
          <div className="progress-label">
            {progress.phase === 'collecting' && `Collecting emails… ${progress.collected ?? 0}`}
            {progress.phase === 'trashing' &&
              `Moving to Trash… ${progress.trashed ?? 0} / ${progress.total ?? '?'}`}
          </div>
          <div className="airmail-progress" role="progressbar" aria-label="Moving emails to Trash" />
        </div>
      )}

      {labels && labels.length === 0 && (
        <div className="empty-state">
          <div className="empty-stamp" aria-hidden="true">🏷</div>
          <h2>No labels yet</h2>
          <p>
            Scan your mailbox on the Senders tab, select senders and use "Label…" to sort them into
            Gmail labels you can manage here.
          </p>
        </div>
      )}

      {labels && labels.length > 0 && (
        <div className="table-card">
          <table className="sender-table">
            <thead>
              <tr>
                <th>Label</th>
                <th className="num">Emails</th>
                <th className="num">Unread</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className="label-name">{l.name}</span>
                  </td>
                  <td className="num">{l.messagesTotal.toLocaleString()}</td>
                  <td className="num">{l.messagesUnread.toLocaleString()}</td>
                  <td className="label-actions">
                    <button
                      className="btn btn-small"
                      disabled={busyId === l.id}
                      onClick={() => setConfirm({ label: l, mode: 'labelOnly' })}
                    >
                      Remove label, keep emails
                    </button>
                    <button
                      className="btn btn-small btn-danger-outline"
                      disabled={busyId === l.id}
                      onClick={() => setConfirm({ label: l, mode: 'trashEmails' })}
                    >
                      Trash emails + delete label
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.mode === 'labelOnly'
              ? `Remove label "${confirm.label.name}"?`
              : `Delete "${confirm.label.name}" and trash its emails?`
          }
          message={
            confirm.mode === 'labelOnly'
              ? `The label will be removed from Gmail. Its ${confirm.label.messagesTotal} emails stay in your mailbox.`
              : `This moves ${confirm.label.messagesTotal} emails to Trash (recoverable for 30 days, then Gmail deletes them permanently) and removes the label.`
          }
          requireTypedCount={confirm.mode === 'trashEmails' && confirm.label.messagesTotal > 500 ? confirm.label.messagesTotal : undefined}
          danger={confirm.mode === 'trashEmails'}
          onCancel={() => setConfirm(null)}
          onConfirm={execute}
        />
      )}
    </div>
  )
}
