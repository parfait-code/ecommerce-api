import { Request, Response, NextFunction } from 'express'
import { reviewService } from './review.service'
import { respond } from '../../shared/utils/response'

export const reviewController = {
  getByProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reviewService.getByProduct(Number(req.params.pid))
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reviewService.getById(req.params.rid as string)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reviewService.create(req.user!.userId, req.body)
      respond(res, result, 201)
    } catch (err) {
      next(err)
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reviewService.update(req.params.rid as string, req.user!.userId, req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reviewService.delete(req.params.rid as string, req.user!.userId)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },
}