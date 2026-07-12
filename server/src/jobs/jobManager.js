import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'

const jobs = new Map()
const MAX_FINISHED = 50

function isFinished(j) {
  return j.state === 'done' || j.state === 'error' || j.state === 'cancelled'
}

function pruneFinished() {
  const finished = [...jobs.values()].filter(isFinished)
  while (finished.length > MAX_FINISHED) {
    const oldest = finished.shift()
    jobs.delete(oldest.id)
  }
}

/**
 * Starts an async job scoped to a userId.
 */
export function createJob(userId, name, runner) {
  const id = crypto.randomUUID()
  const controller = new AbortController()
  const job = {
    id,
    userId,
    name,
    state: 'running',
    progress: null,
    result: null,
    error: null,
    startedAt: Date.now(),
    events: new EventEmitter(),
    controller,
  }
  job.events.setMaxListeners(50)
  jobs.set(id, job)

  const emit = (progress) => {
    job.progress = progress
    job.events.emit('progress', progress)
  }

  Promise.resolve()
    .then(() => runner(emit, controller.signal))
    .then((result) => {
      if (job.state === 'cancelled' || controller.signal.aborted) return
      job.state = 'done'
      job.result = result
      job.events.emit('end')
    })
    .catch((err) => {
      if (job.state === 'cancelled' || controller.signal.aborted) return
      job.state = 'error'
      job.error = err?.message || String(err)
      job.events.emit('end')
    })
    .finally(pruneFinished)

  return job
}

/** Request cancellation of a running job. */
export function cancelJob(userId, id) {
  const job = jobs.get(id)
  if (!job || job.userId !== userId || job.state !== 'running') return false
  job.state = 'cancelled'
  job.error = 'cancelled'
  job.controller.abort()
  job.events.emit('end')
  return true
}

export function getJob(userId, id) {
  const job = jobs.get(id)
  if (!job || (userId && job.userId !== userId)) return null
  return job
}

export function isJobRunning(userId, name) {
  return [...jobs.values()].some((j) => j.userId === userId && j.name === name && j.state === 'running')
}

export function jobSnapshot(job) {
  return {
    id: job.id,
    name: job.name,
    state: job.state,
    progress: job.progress,
    result: job.result,
    error: job.error,
  }
}
