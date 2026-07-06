import { useMemo, useState } from 'react'
import { api, ApiError } from '../api'
import type { Sender, Suggestion } from '../types'
import { CATEGORIES } from '../types'
import { useJob } from '../hooks/useJob'

export default function LabelReview({
  senders,
  suggestions,
  onClose,
  onDisconnected,
}: {
  senders: Sender[]
  suggestions: Map<string, Suggestion>
  onClose: () => void
  onDisconnected: () => void
}) {
  const [assignments, setAssignments] = useState<Map<string, string>>(
    () =>
      new Map(senders.map((s) => [s.email, suggestions.get(s.email)?.category || 'Other']))
  )
  const [error, setError] = useState<string | null>(null)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const applyJob = useJob()

  const byCategory = useMemo(() => {
    const groups = new Map<string, Sender[]>()
    for (const s of senders) {
      const cat = assignments.get(s.email) || 'Other'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(s)
    }
    return groups
  }, [senders, assignments])

  const setCategory = (email: string, category: string) => {
    setAssignments((prev) => new Map(prev).set(email, category))
  }

  const apply = async () => {
    setError(null)
    try {
      const payload = [...assignments].map(([senderEmail, labelName]) => ({ senderEmail, labelName }))
      const snapshot = await applyJob.start(() => api.applyLabels(payload))
      if (snapshot.state === 'error') setError(snapshot.error || 'Applying labels failed')
      else {
        const result = snapshot.result as { applied: { label: string; messages: number }[] }
        setDoneMessage(
          result.applied.map((a) => `${a.label}: ${a.messages} emails`).join(' · ')
        )
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }

  const progress = applyJob.job?.progress as
    | { labeled?: number; total?: number; currentLabel?: string }
    | null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Review labels</h2>
        <p className="hint">
          Labels are created in Gmail as <code>Unsub/&lt;Category&gt;</code> and applied to every
          scanned email from each sender.
        </p>

        {[...byCategory.entries()].map(([category, group]) => (
          <div key={category} className="label-group">
            <h3>
              Unsub/{category} <span className="hint">({group.length} senders)</span>
            </h3>
            {group.map((s) => (
              <div key={s.email} className="label-row">
                <span className="sender-name">{s.name || s.email}</span>
                <span className="hint">{s.messageCount} emails</span>
                <select
                  value={assignments.get(s.email)}
                  onChange={(e) => setCategory(s.email, e.target.value)}
                  disabled={applyJob.running}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ))}

        {error && <div className="banner banner-error">{error}</div>}
        {applyJob.running && progress && (
          <div className="progress-panel">
            <div className="progress-label">
              Labeling {progress.labeled ?? 0} / {progress.total ?? '?'}
              {progress.currentLabel ? ` (${progress.currentLabel})` : ''}
            </div>
            <div className="airmail-progress" role="progressbar" aria-label="Applying labels" />
          </div>
        )}
        {doneMessage && <div className="banner banner-success">Labels applied — {doneMessage}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={applyJob.running}>
            {doneMessage ? 'Close' : 'Cancel'}
          </button>
          {!doneMessage && (
            <button className="btn btn-primary" onClick={apply} disabled={applyJob.running}>
              {applyJob.running ? 'Applying…' : 'Create & apply labels'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
