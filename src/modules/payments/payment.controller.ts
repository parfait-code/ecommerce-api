import { Request, Response, NextFunction } from 'express'
import { paymentService } from './payment.service'
import { respond } from '../../shared/utils/response'

export const paymentController = {
  getMethods: (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = paymentService.getAvailableMethods()
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.create(req.user!.userId, req.body)
      respond(res, result, 201)
    } catch (err) {
      next(err)
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.getById(req.params.payment_id as string)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  getByOrderId: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.getByOrderId(req.params.orderId as string)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },
}