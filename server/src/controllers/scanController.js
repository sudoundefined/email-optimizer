import { createJob, isJobRunning } from '../jobs/jobManager.js'
import { runScan, scanView } from '../services/scanService.js'
import { getScan } from '../store/scanCache.js'
import { runAutoProtect } from '../services/protectService.js'
import { detectSubscriptions } from '../services/subscriptionsService.js'
import { logActivity } from '../services/auditService.js'

export const scanController = {
  startScan(req, res) {
    const userId = req.accountId || req.userId
    if (isJobRunning(userId, 'scan')) {
      return res.status(409).json({ error: 'scan_already_running' })
    }
    const { range = '6m', maxMessages } = req.body || {}
    const job = createJob(userId, 'scan', async (emit, signal) => {
      const result = await runScan(userId, { range, maxMessages }, emit, signal)
      try {
        const scan = getScan(userId)
        if (scan) {
          const added = await runAutoProtect(userId, scan.senders)
          if (added.length > 0) emit({ phase: 'auto-protect', added: added.length })
        }
        await logActivity(userId, 'scan', { senders: result.senders, messages: result.messages, range })
      } catch { /* non-fatal */ }
      return result
    })
    res.json({ jobId: job.id })
  },

  getSenders(req, res) {
    const userId = req.accountId || req.userId
    const scan = getScan(userId)
    if (!scan) return res.status(404).json({ error: 'no_scan', message: 'No scan data found. Please run a new scan.' })
    res.json(scanView(scan))
  },

  getSubscriptions(req, res) {
    const userId = req.accountId || req.userId
    const scan = getScan(userId)
    if (!scan) return res.status(404).json({ error: 'no_scan', message: 'No scan data found. Please run a new scan.' })
    res.json(detectSubscriptions(scan.senders))
  }
}
