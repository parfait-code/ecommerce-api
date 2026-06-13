import { Request, Response, NextFunction } from 'express'
import { userService } from './user.service'
import { respond } from '../../shared/utils/response'

export const userController = {
  getProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await userService.getProfile(req.user!.userId)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  updateProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await userService.updateProfile(req.user!.userId, req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  getAllUsers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await userService.getAllUsers()
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  changeRole: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await userService.changeRole(Number(req.params.userId), req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  deleteUser: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await userService.deleteUser(Number(req.params.userId))
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },
}