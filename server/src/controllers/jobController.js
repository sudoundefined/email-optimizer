import { getJob, jobSnapshot, cancelJob } from '../jobs/jobManager.js'
import { serializeJob } from '../serializers/jobSerializer.js'

export const jobController = {
  getJob(req, res) {
    const userId = req.accountId || req.userId
    const job = getJob(userId, req.params.id)
    if (!job) return res.status(404).json({ error: 'job_not_found' })
    res.json(serializeJob(jobSnapshot(job)))
  },

  cancelJob(req, res) {
    const userId = req.accountId || req.userId
    const cancelled = cancelJob(userId, req.params.id)
    res.json({ cancelled })
  },

  streamEvents(req, res) {
    const userId = req.accountId || req.userId
    const job = getJob(userId, req.params.id)
    if (!job) return res.status(404).json({ error: 'job_not_found' })

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders?.()

    const safeSend = (event, data) => {
      if (res.destroyed || res.writableEnded) return
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(serializeJob(data))}\n\n`)
      } catch { /* client gone */ }
    }

    safeSend('state', jobSnapshot(job))

    if (job.state !== 'running') {
      safeSend('end', jobSnapshot(job))
      if (!res.destroyed && !res.writableEnded) res.end()
      return
    }

    let cleaned = false
    function cleanup() {
      if (cleaned) return
      cleaned = true
      clearInterval(heartbeat)
      job.events.off('progress', onProgress)
      job.events.off('end', onEnd)
    }

    const onProgress = () => safeSend('state', jobSnapshot(job))
    const onEnd = () => {
      safeSend('end', jobSnapshot(job))
      cleanup()
      if (!res.destroyed && !res.writableEnded) res.end()
    }
    const heartbeat = setInterval(() => {
      if (res.destroyed || res.writableEnded) { cleanup(); return }
      try { res.write(': ping\n\n') } catch { cleanup() }
    }, 15000)

    job.events.on('progress', onProgress)
    job.events.on('end', onEnd)
    req.on('close', cleanup)
  }
}
