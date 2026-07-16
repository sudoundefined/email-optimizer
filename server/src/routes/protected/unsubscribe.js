import { Router } from 'express'
import { unsubscribeController } from '../../controllers/unsubscribeController.js'

const router = Router()

router.post('/unsubscribe', unsubscribeController.unsubscribe)

export default router
