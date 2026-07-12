import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api'
import type { JobSnapshot } from '../types'

// How many consecutive poll failures (server unreachable, e.g. a dev-server
// restart on save) to tolerate before giving up so the UI never stays stuck
// "running" forever. 2s interval × 15 ≈ 30s grace.
const MAX_POLL_FAILURES = 15

/**
 * Runs a job: call start() with a function that POSTs and returns {jobId},
 * then streams progress over SSE (poll fallback every 2s if SSE fails).
 *
 * Resilience: if the backend becomes unreachable mid-job (dev-server restart,
 * proxy ECONNREFUSED), polling retries a bounded number of times and then
 * resolves to an error snapshot instead of hanging with running=true. cancel()
 * always resolves the pending run and clears local state even when the cancel
 * request itself can't reach the server.
 */
export function useJob() {
  const [job, setJob] = useState<JobSnapshot | null>(null)
  const [running, setRunning] = useState(false)
  const cleanupRef = useRef<() => void>(() => {})
  const jobIdRef = useRef<string | null>(null)
  // Resolves the current run's promise; null when no run is in flight.
  const finishRef = useRef<((snapshot: JobSnapshot) => void) | null>(null)
  // Bumped on every start() so a stale SSE/poll from a previous run can't
  // mutate state belonging to a newer run.
  const genRef = useRef(0)

  // Tear down any in-flight stream if the component unmounts.
  useEffect(() => () => cleanupRef.current(), [])

  const start = useCallback(async (starter: () => Promise<{ jobId: string }>) => {
    cleanupRef.current()
    const gen = ++genRef.current
    setJob(null)
    setRunning(true)
    let jobId: string
    try {
      const res = await starter()
      jobId = res.jobId
      jobIdRef.current = jobId
    } catch (err) {
      setRunning(false)
      throw err
    }

    return new Promise<JobSnapshot>((resolve) => {
      let pollTimer: ReturnType<typeof setInterval> | undefined
      let pollFailures = 0
      const es = new EventSource(`/api/jobs/${jobId}/events`)

      const isCurrent = () => genRef.current === gen

      const finish = (snapshot: JobSnapshot) => {
        cleanup()
        finishRef.current = null
        if (!isCurrent()) return
        setJob(snapshot)
        setRunning(false)
        resolve(snapshot)
      }
      finishRef.current = finish

      const cleanup = () => {
        es.close()
        if (pollTimer) clearInterval(pollTimer)
        pollTimer = undefined
      }
      cleanupRef.current = cleanup

      es.addEventListener('state', (e) => {
        if (!isCurrent()) { cleanup(); return }
        const snap = JSON.parse((e as MessageEvent).data) as JobSnapshot
        setJob(snap)
        if (snap.state !== 'running') finish(snap)
      })
      es.addEventListener('end', (e) => {
        finish(JSON.parse((e as MessageEvent).data) as JobSnapshot)
      })
      es.onerror = () => {
        // SSE broken — fall back to polling. Give up after too many
        // consecutive network failures so the UI can't hang forever.
        es.close()
        if (!isCurrent()) { cleanup(); return }
        if (!pollTimer) {
          pollTimer = setInterval(async () => {
            if (!isCurrent()) { cleanup(); return }
            try {
              const snap = await api.job(jobId)
              pollFailures = 0
              setJob(snap)
              if (snap.state !== 'running') finish(snap)
            } catch (err) {
              // A 404 means the job is gone (server restarted and lost its
              // in-memory job registry) — stop immediately rather than waiting
              // out the whole failure budget.
              const gone = err instanceof ApiError && err.status === 404
              if (gone || ++pollFailures >= MAX_POLL_FAILURES) {
                finish({
                  id: jobId,
                  name: '',
                  state: 'error',
                  progress: null,
                  result: null,
                  error: gone
                    ? 'The job could not be found — the server may have restarted. Please try again.'
                    : 'Lost connection to the server. Please try again.',
                })
              }
            }
          }, 2000)
        }
      }
    })
  }, [])

  const cancel = useCallback(async () => {
    const id = jobIdRef.current
    jobIdRef.current = null
    // Resolve the pending run as cancelled and tear everything down locally —
    // even if the cancel request below can't reach the server (that's usually
    // exactly why we're cancelling).
    const done = finishRef.current
    if (done) {
      done({ id: id ?? '', name: '', state: 'cancelled', progress: null, result: null, error: null })
    } else {
      cleanupRef.current()
      setRunning(false)
    }
    if (!id) return
    try {
      await api.cancelJob(id)
    } catch {
      /* best effort — the job may have already finished or be unreachable */
    }
  }, [])

  return { job, running, start, cancel }
}
