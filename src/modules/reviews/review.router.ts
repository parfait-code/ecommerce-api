import { Router } from 'express'
import { reviewController } from './review.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { validate } from '../../shared/middlewares/validate'
import { createReviewSchema, updateReviewSchema } from './review.schema'

const router = Router()

router.get('/products/:pid/reviews', reviewController.getByProduct)
router.get('/reviews/:rid', reviewController.getById)
router.post('/reviews', authGuard, validate(createReviewSchema), reviewController.create)
router.put('/reviews/:rid', authGuard, validate(updateReviewSchema), reviewController.update)
router.delete('/reviews/:rid', authGuard, reviewController.delete)

export default router