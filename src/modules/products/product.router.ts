import { Router } from 'express'
import { productController } from './product.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { adminGuard } from '../../shared/middlewares/admin-guard'
import { validate } from '../../shared/middlewares/validate'
import { createProductSchema, updateProductSchema } from './product.schema'

const router = Router()

router.get('/product', productController.getAll)
router.get('/product/:productId', productController.getById)
router.post('/product', authGuard, adminGuard, validate(createProductSchema), productController.create)
router.patch('/product/:productId', authGuard, adminGuard, validate(updateProductSchema), productController.update)
router.delete('/product/:productId', authGuard, adminGuard, productController.delete)

export default router