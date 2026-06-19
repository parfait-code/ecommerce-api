import { Router } from 'express'
import { categoryController } from './category.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { adminGuard } from '../../shared/middlewares/admin-guard'
import { validate } from '../../shared/middlewares/validate'
import { createCategorySchema, updateCategorySchema } from './category.schema'

const router = Router()

router.get('/categories',                     authGuard, categoryController.getAll)
router.get('/categories/:categoryId',         authGuard, categoryController.getById)
router.get('/categories/slug/:slug',          categoryController.getBySlug)
router.get('/categories/slug/:slug/products', categoryController.getProducts)
router.post('/categories',                    authGuard, adminGuard, validate(createCategorySchema), categoryController.create)
router.put('/categories/:categoryId',         authGuard, adminGuard, validate(updateCategorySchema), categoryController.update)
router.delete('/categories/:categoryId',      authGuard, adminGuard, categoryController.delete)

export default router