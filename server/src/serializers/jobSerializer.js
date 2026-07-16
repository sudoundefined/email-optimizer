/**
 * Serializes background job metadata and SSE events cleanly.
 */
export function serializeJob(job) {
  if (!job) return null
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress || 0,
    phase: job.phase || '',
    result: job.result || null,
    error: job.error || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  }
}
