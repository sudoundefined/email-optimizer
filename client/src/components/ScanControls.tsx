import { useState } from 'react'
import type { JobSnapshot, ScanResult } from '../types'

const RANGES = [
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
]

export default function ScanControls({
  onScan,
  job,
  running,
  scan,
}: {
  onScan: (range: string) => void
  job: JobSnapshot | null
  running: boolean
  scan: ScanResult | null
}) {
  const [range, setRange] = useState('6m')
  const progress = job?.progress as { phase?: string; listed?: number; fetched?: number; total?: number } | null

  return (
    <div className="scan-card">
      <div className="scan-row">
        <label className="scan-range">
          <span className="field-label">Range</span>
          <select value={range} onChange={(e) => setRange(e.target.value)} disabled={running}>
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" onClick={() => onScan(range)} disabled={running}>
          {running ? 'Scanning…' : 'Scan mailbox'}
        </button>

        {!running && scan && (
          <div className="scan-stats">
            <span className="stat">
              <strong>{scan.senders.length.toLocaleString()}</strong> senders
            </span>
            <span className="stat-divider" aria-hidden="true" />
            <span className="stat">
              <strong>{scan.messageCount.toLocaleString()}</strong> emails
            </span>
            <span className="scan-time">scanned {new Date(scan.scannedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {running && (
        <div className="progress-panel progress-inline">
          <div className="progress-label">
            {progress?.phase === 'listing' && `Finding messages… ${progress.listed ?? 0} found`}
            {progress?.phase === 'fetching' &&
              `Reading headers… ${progress.fetched ?? 0} / ${progress.total ?? '?'}`}
            {progress?.phase === 'grouping' && 'Grouping senders…'}
            {!progress?.phase && 'Starting scan…'}
          </div>
          <div className="airmail-progress" role="progressbar" aria-label="Scanning mailbox" />
        </div>
      )}
    </div>
  )
}
