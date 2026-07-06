import type { UnsubResult, UnsubSummary } from '../types'

const STATUS_ICONS = { success: '✓', manual: '⚠', failed: '✗' } as const

function ResultRow({ r }: { r: UnsubResult }) {
  return (
    <li className={`unsub-row unsub-${r.status}`}>
      <span className="unsub-icon">{STATUS_ICONS[r.status]}</span>
      <span className="unsub-sender">{r.sender}</span>
      <span className="unsub-detail">{r.detail}</span>
      {r.manualUrl && (
        <a className="btn btn-small" href={r.manualUrl} target="_blank" rel="noopener noreferrer">
          Open
        </a>
      )}
    </li>
  )
}

export default function UnsubscribePanel({
  summary,
  progress,
  running,
}: {
  summary?: UnsubSummary
  progress?: { done: number; total: number; results: UnsubResult[] }
  running?: boolean
}) {
  const results = summary?.results ?? progress?.results ?? []
  return (
    <div className="unsub-panel">
      {running && progress && (
        <div className="unsub-header">
          Unsubscribing… {progress.done} / {progress.total}
        </div>
      )}
      {summary && (
        <div className="unsub-header">
          Done: {summary.success} unsubscribed, {summary.manual} need a manual click,{' '}
          {summary.failed} failed
        </div>
      )}
      <ul className="unsub-list">
        {results.map((r) => (
          <ResultRow key={r.sender} r={r} />
        ))}
      </ul>
    </div>
  )
}
