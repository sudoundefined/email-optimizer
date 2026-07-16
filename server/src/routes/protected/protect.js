import { Router } from 'express'
import { protectController } from '../../controllers/protectController.js'

const router = Router()

router.get('/protect', protectController.list)
router.post('/protect', protectController.add)
router.delete('/protect', protectController.remove)

export default router
