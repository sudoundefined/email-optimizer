import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../api'
import type { ScanResult, Suggestion, UnsubSummary, ProtectedSender } from '../types'
import { useJob } from '../hooks/useJob'
import ScanControls from './ScanControls'
import SenderTable from './SenderTable'
import UnsubscribePanel from './UnsubscribePanel'
import LabelReview from './LabelReview'
import ConfirmDialog from './ConfirmDialog'
import ProtectedTab from './ProtectedTab'

export default function SendersTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [unsubSummary, setUnsubSummary] = useState<UnsubSummary | null>(null)
  const [showLabelReview, setShowLabelReview] = useState(false)
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [trashDone, setTrashDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [protectedList, setProtectedList] = useState<ProtectedSender[]>([])
  const [showProtected, setShowProtected] = useState(false)
  const [protectionWarning, setProtectionWarning] = useState<string | null>(null)

  const scanJob = useJob()
  const unsubJob = useJob()
  const trashJob = useJob()

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const loadSenders = useCallback(async () => {
    try {
      const result = await api.senders()
      setScan(result)
      setSuggestions(await api.suggestions())
      const protectedRes = await api.protectedList()
      setProtectedList(protectedRes.protected)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) return
      handleApiError(err)
    }
  }, [handleApiError])

  useEffect(() => {
    loadSenders()
  }, [loadSenders])

  const runScan = async (range: string) => {
    setError(null)
    setUnsubSummary(null)
    setTrashDone(null)
    setSelected(new Set())
    try {
      const snapshot = await scanJob.start(() => api.startScan(range))
      if (snapshot.state === 'error') setError(snapshot.error || 'Scan failed')
      else await loadSenders()
    } catch (err) {
      handleApiError(err)
    }
  }

  const runUnsubscribe = async () => {
    setError(null)
    setUnsubSummary(null)
    setTrashDone(null)
    setProtectionWarning(null)
    try {
      const emails = [...selected]
      const response = await api.startUnsubscribe(emails)

      if (response.excluded > 0) {
        setProtectionWarning(
          `${response.excluded} protected sender${response.excluded > 1 ? 's' : ''} excluded from this action.`
        )
      }

      if (!response.jobId) {
        setError('All selected senders are protected')
        return
      }

      const snapshot = await unsubJob.start(() => Promise.resolve({ jobId: response.jobId! }))
      if (snapshot.state === 'error') setError(snapshot.error || 'Unsubscribe failed')
      else setUnsubSummary(snapshot.result as UnsubSummary)
    } catch (err) {
      handleApiError(err)
    }
  }

  const runTrash = async () => {
    setConfirmTrash(false)
    setError(null)
    setUnsubSummary(null)
    setTrashDone(null)
    setProtectionWarning(null)
    try {
      const emails = [...selected]
      const response = await api.trashSenders(emails)

      if (response.excluded > 0) {
        setProtectionWarning(
          `${response.excluded} protected sender${response.excluded > 1 ? 's' : ''} excluded from this action.`
        )
      }

      if (!response.jobId) {
        setError('All selected senders are protected')
        return
      }

      const snapshot = await trashJob.start(() => Promise.resolve({ jobId: response.jobId! }))
      if (snapshot.state === 'error') {
        setError(snapshot.error || 'Moving to Trash failed')
      } else {
        const result = snapshot.result as { trashed: number; senders: number }
        setTrashDone(
          `Moved ${result.trashed.toLocaleString()} emails from ${result.senders} senders to Trash. They stay recoverable in Gmail Trash for 30 days.`
        )
        setSelected(new Set())
        await loadSenders()
      }
    } catch (err) {
      handleApiError(err)
    }
  }

  const runProtect = async () => {
    setError(null)
    setProtectionWarning(null)
    try {
      const nonProtected = selectedSenders.filter(s => !protectedSet.has(s.email.toLowerCase()))
      if (nonProtected.length === 0) return
      await api.protectSenders(nonProtected.map(s => s.email))
      await loadSenders()
      setSelected(new Set())
    } catch (err) {
      handleApiError(err)
    }
  }

  const runUnprotect = async () => {
    setError(null)
    setProtectionWarning(null)
    try {
      const protectedSenders = selectedSenders.filter(s => protectedSet.has(s.email.toLowerCase()))
      if (protectedSenders.length === 0) return
      await api.unprotectSenders(protectedSenders.map(s => s.email))
      await loadSenders()
      setSelected(new Set())
    } catch (err) {
      handleApiError(err)
    }
  }

  const suggestionMap = useMemo(() => {
    const m = new Map<string, Suggestion>()
    for (const s of suggestions || []) m.set(s.senderEmail, s)
    return m
  }, [suggestions])

  const protectedSet = useMemo(() => {
    return new Set(protectedList.map(p => p.email.toLowerCase()))
  }, [protectedList])

  const selectedSenders = useMemo(
    () => (scan ? scan.senders.filter((s) => selected.has(s.email)) : []),
    [scan, selected]
  )
  const selectedUnsubscribable = selectedSenders.filter((s) => s.method !== 'none').length
  const selectedEmailCount = selectedSenders.reduce((n, s) => n + s.messageCount, 0)
  const selectedProtectedCount = useMemo(() => {
    return selectedSenders.filter(s => protectedSet.has(s.email.toLowerCase())).length
  }, [selectedSenders, protectedSet])
  const selectedNonProtectedCount = selectedSenders.length - selectedProtectedCount

  const trashProgress = trashJob.job?.progress as { trashed?: number; total?: number } | null

  return (
    <div>
      <ScanControls onScan={runScan} job={scanJob.job} running={scanJob.running} scan={scan} />
      {error && <div className="banner banner-error">{error}</div>}
      {trashDone && <div className="banner banner-success">{trashDone}</div>}
      {protectionWarning && <div className="banner banner-error">{protectionWarning}</div>}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', marginTop: '8px' }}>
        <button
          className={!showProtected ? 'btn btn-primary btn-small' : 'btn btn-small'}
          onClick={() => setShowProtected(false)}
        >
          All Senders
        </button>
        <button
          className={showProtected ? 'btn btn-primary btn-small' : 'btn btn-small'}
          onClick={() => setShowProtected(true)}
        >
          Protected ({protectedList.length})
        </button>
      </div>

      {trashJob.running && trashProgress && (
        <div className="progress-panel">
          <div className="progress-label">
            Moving to Trash… {trashProgress.trashed ?? 0} / {trashProgress.total ?? '?'} emails
          </div>
          <div className="airmail-progress" role="progressbar" aria-label="Moving emails to Trash" />
        </div>
      )}

      {unsubJob.running && unsubJob.job?.progress != null && (
        <UnsubscribePanel progress={unsubJob.job.progress as never} running />
      )}
      {unsubSummary && <UnsubscribePanel summary={unsubSummary} />}

      {!showProtected && !scan && !scanJob.running && (
        <div className="empty-state">
          <div className="empty-stamp" aria-hidden="true">✉</div>
          <h2>See who's filling your inbox</h2>
          <p>
            Scan your mailbox to group marketing email by sender, then unsubscribe, label, or trash
            them in bulk.
          </p>
        </div>
      )}

      {!showProtected && scan && (
        <SenderTable
          senders={scan.senders}
          selected={selected}
          onSelectedChange={setSelected}
          suggestions={suggestionMap}
        />
      )}

      {showProtected && <ProtectedTab onDisconnected={onDisconnected} />}

      {!showProtected && selected.size > 0 && (
        <div className="tray" role="toolbar" aria-label="Actions for selected senders">
          <div className="tray-info">
            <span className="tray-count">{selected.size}</span>
            <span>
              senders · <strong>{selectedEmailCount.toLocaleString()}</strong> emails
              {selectedUnsubscribable < selected.size &&
                ` · ${selectedUnsubscribable} with unsubscribe support`}
            </span>
          </div>
          <div className="tray-actions">
            <button
              className="btn btn-primary"
              disabled={selectedUnsubscribable === 0 || unsubJob.running || trashJob.running}
              onClick={runUnsubscribe}
            >
              Unsubscribe
            </button>
            <button
              className="btn"
              disabled={unsubJob.running || trashJob.running}
              onClick={() => setShowLabelReview(true)}
            >
              Label…
            </button>
            {selectedNonProtectedCount > 0 && (
              <button
                className="btn"
                disabled={unsubJob.running || trashJob.running}
                onClick={runProtect}
              >
                Protect
              </button>
            )}
            {selectedProtectedCount > 0 && (
              <button
                className="btn"
                disabled={unsubJob.running || trashJob.running}
                onClick={runUnprotect}
              >
                Unprotect
              </button>
            )}
            <button
              className="btn btn-danger-outline"
              disabled={unsubJob.running || trashJob.running}
              onClick={() => setConfirmTrash(true)}
            >
              Move to Trash
            </button>
            <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}

      {showLabelReview && scan && (
        <LabelReview
          senders={selectedSenders}
          suggestions={suggestionMap}
          onClose={() => setShowLabelReview(false)}
          onDisconnected={onDisconnected}
        />
      )}

      {confirmTrash && (
        <ConfirmDialog
          title={`Move ${selectedEmailCount.toLocaleString()} emails to Trash?`}
          message={`Every scanned email from the ${selected.size} selected senders goes to Gmail Trash. Trash is recoverable for 30 days, then Gmail deletes it permanently. This does not unsubscribe you — new emails will still arrive.`}
          danger
          requireTypedCount={selectedEmailCount > 500 ? selectedEmailCount : undefined}
          onCancel={() => setConfirmTrash(false)}
          onConfirm={runTrash}
        />
      )}
    </div>
  )
}
