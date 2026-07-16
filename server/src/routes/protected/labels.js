import { Router } from 'express'
import { labelController } from '../../controllers/labelController.js'

const router = Router()

router.get('/labels/suggestions', labelController.getSuggestions)
router.post('/labels/apply', labelController.applyLabels)
router.post('/labels/apply-filter', labelController.applyFilter)
router.post('/labels/query', labelController.applyFilter)
router.get('/labels', labelController.listLabels)
router.delete('/labels/:id', labelController.deleteLabel)
router.get('/labels/:id/messages', labelController.getMessages)

export default router
