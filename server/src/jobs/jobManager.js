import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'

const jobs = new Map()
const MAX_FINISHED = 20

function pruneFinished() {
  const finished = [...jobs.values()].filter((j) => j.state === 'done' || j.state === 'error')
  while (finished.length > MAX_FINISHED) {
    const oldest = finished.shift()
    jobs.delete(oldest.id)
  }
}

/**
 * Starts an async job. runner receives an emit(progress) callback and
 * its return value becomes the job result.
 * Returns the job record {id, name, state, progress, result, error}.
 */
export function createJob(name, runner) {
  const id = crypto.randomUUID()
  const job = {
    id,
    name,
    state: 'running',
    progress: null,
    result: null,
    error: null,
    startedAt: Date.now(),
    events: new EventEmitter(),
  }
  job.events.setMaxListeners(50)
  jobs.set(id, job)

  const emit = (progress) => {
    job.progress = progress
    job.events.emit('progress', progress)
  }

  Promise.resolve()
    .then(() => runner(emit))
    .then((result) => {
      job.state = 'done'
      job.result = result
      job.events.emit('end')
    })
    .catch((err) => {
      job.state = 'error'
      job.error = err?.message || String(err)
      job.events.emit('end')
    })
    .finally(pruneFinished)

  return job
}

export function getJob(id) {
  return jobs.get(id) || null
}

export function isJobRunning(name) {
  return [...jobs.values()].some((j) => j.name === name && j.state === 'running')
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
