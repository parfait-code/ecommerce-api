import { Request, Response, NextFunction } from 'express'
import { checkoutService } from './checkout.service'
import { respond } from '../../shared/utils/response'

export const checkoutController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await checkoutService.create(req.user!.userId, req.body)
      respond(res, result, 201)
    } catch (err) {
      next(err)
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await checkoutService.getById(req.params.checkout_id as string)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  complete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await checkoutService.complete(req.params.checkout_id as string, req.user!.userId)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },
}