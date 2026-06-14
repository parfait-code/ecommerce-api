import { Router } from 'express'
import { addressController } from './address.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { validate } from '../../shared/middlewares/validate'
import { validateAddressSchema, createAddressSchema, updateAddressSchema } from './address.schema'

const router = Router()

router.post('/address/validate', validate(validateAddressSchema), addressController.validate)
router.get('/addresses', authGuard, addressController.getAll)
router.get('/addresses/:addressId', authGuard, addressController.getById)
router.post('/addresses', authGuard, validate(createAddressSchema), addressController.create)
router.patch('/addresses/:addressId', authGuard, validate(updateAddressSchema), addressController.update)
router.delete('/addresses/:addressId', authGuard, addressController.delete)

export default router