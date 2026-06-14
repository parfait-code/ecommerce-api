import { Router } from 'express'
import { checkoutController } from './checkout.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { validate } from '../../shared/middlewares/validate'
import { createCheckoutSchema } from './checkout.schema'

const router = Router()

router.post('/checkout', authGuard, validate(createCheckoutSchema), checkoutController.create)
router.get('/checkout/:checkout_id', authGuard, checkoutController.getById)
router.post('/checkout/:checkout_id/complete', authGuard, checkoutController.complete)

export default router