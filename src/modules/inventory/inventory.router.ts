import { Router } from 'express'
import { inventoryController } from './inventory.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { adminGuard } from '../../shared/middlewares/admin-guard'
import { validate } from '../../shared/middlewares/validate'
import { createInventorySchema, updateInventorySchema, transferInventorySchema } from './inventory.schema'

const router = Router()

router.get('/inventory', authGuard, inventoryController.getAll)
router.get('/inventory/low-stock', authGuard, inventoryController.getLowStock)
router.get('/inventory/out-of-stock', authGuard, inventoryController.getOutOfStock)
router.get('/inventory/search', authGuard, inventoryController.search)
router.get('/inventory/:item_id', authGuard, inventoryController.getById)
router.post('/inventory', authGuard, adminGuard, validate(createInventorySchema), inventoryController.create)
router.put('/inventory/:item_id', authGuard, adminGuard, validate(updateInventorySchema), inventoryController.update)
router.delete('/inventory/:item_id', authGuard, adminGuard, inventoryController.delete)
router.post('/inventory/transfer', authGuard, adminGuard, validate(transferInventorySchema), inventoryController.transfer)

export default router