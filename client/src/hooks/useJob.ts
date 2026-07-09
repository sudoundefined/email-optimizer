import { useCallback, useRef, useState } from 'react'
import { api } from '../api'
import type { JobSnapshot } from '../types'

/**
 * Runs a job: call start() with a function that POSTs and returns {jobId},
 * then streams progress over SSE (poll fallback every 2s if SSE fails).
 */
export function useJob() {
  const [job, setJob] = useState<JobSnapshot | null>(null)
  const [running, setRunning] = useState(false)
  const cleanupRef = useRef<() => void>(() => {})
  const jobIdRef = useRef<string | null>(null)

  const start = useCallback(async (starter: () => Promise<{ jobId: string }>) => {
    cleanupRef.current()
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
      const es = new EventSource(`/api/jobs/${jobId}/events`)

      const finish = (snapshot: JobSnapshot) => {
        cleanup()
        setJob(snapshot)
        setRunning(false)
        resolve(snapshot)
      }

      const cleanup = () => {
        es.close()
        if (pollTimer) clearInterval(pollTimer)
      }
      cleanupRef.current = cleanup

      es.addEventListener('state', (e) => {
        const snap = JSON.parse((e as MessageEvent).data) as JobSnapshot
        setJob(snap)
        if (snap.state !== 'running') finish(snap)
      })
      es.addEventListener('end', (e) => {
        finish(JSON.parse((e as MessageEvent).data) as JobSnapshot)
      })
      es.onerror = () => {
        // SSE broken — fall back to polling
        es.close()
        if (!pollTimer) {
          pollTimer = setInterval(async () => {
            try {
              const snap = await api.job(jobId)
              setJob(snap)
              if (snap.state !== 'running') finish(snap)
            } catch {
              /* keep polling */
            }
          }, 2000)
        }
      }
    })
  }, [])

  const cancel = useCallback(async () => {
    const id = jobIdRef.current
    if (!id) return
    try {
      await api.cancelJob(id)
    } catch {
      /* best effort — the job may have already finished */
    }
  }, [])

  return { job, running, start, cancel }
}
