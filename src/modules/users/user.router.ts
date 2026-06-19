// src/modules/users/user.router.ts
import { Router } from 'express'
import { userController } from './user.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { adminGuard } from '../../shared/middlewares/admin-guard'
import { validate } from '../../shared/middlewares/validate'
import { updateUserSchema, changeRoleSchema, adminCreateUserSchema } from './user.schema'

const router = Router()

router.get('/user', authGuard, userController.getProfile)
router.patch('/user', authGuard, validate(updateUserSchema), userController.updateProfile)

// Routes statiques AVANT les routes dynamiques (:userId)
router.get('/user/all', authGuard, adminGuard, userController.getAllUsers)
router.patch('/user/change-role/:userId', authGuard, adminGuard, validate(changeRoleSchema), userController.changeRole)
router.post('/user', authGuard, adminGuard, validate(adminCreateUserSchema), userController.adminCreateUser)

// Route dynamique EN DERNIER
router.get('/user/:userId', authGuard, adminGuard, userController.getUserById)
router.delete('/user/:userId', authGuard, adminGuard, userController.deleteUser)

export default router