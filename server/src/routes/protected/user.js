import { Router } from 'express'
import { userController } from '../../controllers/userController.js'

const router = Router()

router.get('/profile', userController.getProfile)
router.get('/preferences', userController.getPreferences)
router.patch('/preferences', userController.updatePreferences)
router.get('/activity', userController.getActivityLog)
router.get('/gamification', userController.getGamification)

router.get('/onboarding', userController.getOnboardingState)
router.patch('/onboarding', userController.updateOnboardingStep)
router.post('/onboarding/configure', userController.configureOnboardingScan)
router.get('/onboarding/story', userController.getMailboxStory)
router.post('/onboarding/complete', userController.completeOnboarding)

export default router
