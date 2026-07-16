import express from 'express'
import userRoutes from './user.js'
import jobRoutes from './jobs.js'
import scanRoutes from './scan.js'
import unsubscribeRoutes from './unsubscribe.js'
import labelRoutes from './labels.js'
import inboxRoutes from './inbox.js'
import protectRoutes from './protect.js'
import storageRoutes from './storage.js'
import messageRoutes from './messages.js'
import digestRoutes from './digest.js'
import logsRoutes from './logs.js'
import insightsRoutes from './insights.js'

const protectedRouter = express.Router()

protectedRouter.use('/user', userRoutes)
protectedRouter.use('/jobs', jobRoutes)
protectedRouter.use('/insights', insightsRoutes)
protectedRouter.use('/', scanRoutes)
protectedRouter.use('/', unsubscribeRoutes)
protectedRouter.use('/', labelRoutes)
protectedRouter.use('/', inboxRoutes)
protectedRouter.use('/', protectRoutes)
protectedRouter.use('/', storageRoutes)
protectedRouter.use('/', messageRoutes)
protectedRouter.use('/', digestRoutes)
protectedRouter.use('/', logsRoutes)

export default protectedRouter
