import { Router } from 'express'
import { insightsController } from '../../controllers/insightsController.js'

const router = Router()

router.get('/dashboard', insightsController.getDashboard)
router.get('/health', insightsController.getHealth)
router.get('/priorities', insightsController.getPriorities)
router.get('/dna', insightsController.getDna)
router.get('/achievements', insightsController.getAchievements)
router.get('/story', insightsController.getStory)
router.post('/recalculate', insightsController.recalculate)

export default router
