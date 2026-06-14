import { Router } from 'express'
import { orderController } from './order.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { validate } from '../../shared/middlewares/validate'
import { createOrderSchema, updateOrderSchema, updateOrderStatusSchema } from './order.schema'

const router = Router()

router.get('/orders', authGuard, orderController.getAll)
router.post('/orders', authGuard, validate(createOrderSchema), orderController.create)
router.get('/orders/:orderId', authGuard, orderController.getById)
router.put('/orders/:orderId', authGuard, validate(updateOrderSchema), orderController.update)
router.delete('/orders/:orderId', authGuard, orderController.delete)
router.get('/orders/:orderId/status', authGuard, orderController.getById)
router.put('/orders/:orderId/status', authGuard, validate(updateOrderStatusSchema), orderController.updateStatus)

export default router