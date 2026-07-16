import { Router } from 'express'
import { digestController } from '../../controllers/digestController.js'

const router = Router()

router.get('/digest', digestController.getState)
router.post('/digest/settings', digestController.updateSettings)
router.post('/digest/run', digestController.run)
router.post('/digest/preview', digestController.preview)

export default router
