import { Router } from 'express'
import { jobController } from '../../controllers/jobController.js'

const router = Router()

router.get('/:id', jobController.getJob)
router.post('/:id/cancel', jobController.cancelJob)
router.get('/:id/events', jobController.streamEvents)

export default router
