import { Router } from 'express'
import { scanController } from '../../controllers/scanController.js'
import { senderController } from '../../controllers/senderController.js'

const router = Router()

router.post('/scan', scanController.startScan)
router.get('/senders', scanController.getSenders)
router.get('/subscriptions', scanController.getSubscriptions)
router.post('/senders/trash', senderController.trashSenders)
router.post('/senders/keep-latest', senderController.keepLatest)

export default router
