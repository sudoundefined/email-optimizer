import { Router } from 'express'
import { getJob, jobSnapshot } from '../jobs/jobManager.js'

const router = Router()

router.get('/:id', (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return res.status(404).json({ error: 'job_not_found' })
  res.json(jobSnapshot(job))
})

router.get('/:id/events', (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return res.status(404).json({ error: 'job_not_found' })

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  send('state', jobSnapshot(job))

  if (job.state !== 'running') {
    send('end', jobSnapshot(job))
    return res.end()
  }

  const onProgress = () => send('state', jobSnapshot(job))
  const onEnd = () => {
    send('end', jobSnapshot(job))
    cleanup()
    res.end()
  }
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000)

  function cleanup() {
    clearInterval(heartbeat)
    job.events.off('progress', onProgress)
    job.events.off('end', onEnd)
  }

  job.events.on('progress', onProgress)
  job.events.on('end', onEnd)
  req.on('close', cleanup)
})

export default router
