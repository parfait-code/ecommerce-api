import { Router } from 'express'
import { dashboardController } from './dashboard.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { adminGuard } from '../../shared/middlewares/admin-guard'

const router = Router()

router.get('/dashboard/stats',       authGuard, adminGuard, dashboardController.getStats)
router.get('/dashboard/sales-chart', authGuard, adminGuard, dashboardController.getSalesChart)

export default router