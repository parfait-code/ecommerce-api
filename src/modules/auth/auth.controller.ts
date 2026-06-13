import { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service'
import { respond } from '../../shared/utils/response'

export const authController = {
  signup: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.signup(req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  login: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },
}