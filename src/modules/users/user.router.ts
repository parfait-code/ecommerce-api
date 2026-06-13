import { Router } from 'express'
import { userController } from './user.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { adminGuard } from '../../shared/middlewares/admin-guard'
import { validate } from '../../shared/middlewares/validate'
import { updateUserSchema, changeRoleSchema } from './user.schema'

const router = Router()

router.get('/user', authGuard, userController.getProfile)
router.patch('/user', authGuard, validate(updateUserSchema), userController.updateProfile)
router.get('/user/all', authGuard, adminGuard, userController.getAllUsers)
router.patch('/user/change-role/:userId', authGuard, adminGuard, validate(changeRoleSchema), userController.changeRole)
router.delete('/user/:userId', authGuard, adminGuard, userController.deleteUser)

export default router