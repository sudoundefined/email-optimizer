import { Router } from 'express'
import { authController } from '../controllers/authController.js'
import { authMiddleware } from '../middleware/auth.js'
import { csrfProtection } from '../middleware/security.js'

const router = Router()

router.get('/status', authController.status)
router.get('/login', authController.login)
router.post('/demo-login', csrfProtection, authController.demoLogin)
router.get('/callback', authController.callback)
router.post('/logout', csrfProtection, authController.logout)
router.delete('/accounts/:id', authMiddleware, csrfProtection, authController.disconnectAccount)

export default router
