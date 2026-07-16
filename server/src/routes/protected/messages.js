import { Router } from 'express'
import { messageController } from '../../controllers/messageController.js'

const router = Router()

router.post('/messages/trash', messageController.trash)
router.delete('/messages/trash', messageController.empty)

export default router
