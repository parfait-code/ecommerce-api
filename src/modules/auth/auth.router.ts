import { Router } from 'express'
import { authController } from './auth.controller'
import { validate } from '../../shared/middlewares/validate'
import { signupSchema, loginSchema } from './auth.schema'

const router = Router()

router.post('/signup', validate(signupSchema), authController.signup)
router.post('/login', validate(loginSchema), authController.login)

export default router