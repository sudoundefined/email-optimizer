import { Router } from 'express'
import { inboxController } from '../../controllers/inboxController.js'

const router = Router()

router.get('/inbox/filters', inboxController.getFilters)
router.get('/inbox/groups', inboxController.getGroups)
router.get('/inbox/groups/:key/messages', inboxController.getGroupMessages)
router.get('/inbox/labels', inboxController.getLabels)
router.get('/inbox/filter', inboxController.filter)
router.post('/inbox/filter/:key/trash', inboxController.trashByFilter)

export default router
