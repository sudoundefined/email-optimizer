import { Router } from 'express'
import { storageController } from '../../controllers/storageController.js'

const router = Router()

router.get('/storage/stats', storageController.getStats)
router.post('/storage/refresh', storageController.refresh)
router.get('/storage/messages', storageController.getMessages)

export default router
