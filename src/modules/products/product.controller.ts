import { Request, Response, NextFunction } from 'express'
import { productService } from './product.service'
import { respond } from '../../shared/utils/response'

export const productController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.getAll(req.query as { page?: string; limit?: string })
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.getById(Number(req.params.productId))
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.create(req.body)
      respond(res, result, 201)
    } catch (err) {
      next(err)
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.update(Number(req.params.productId), req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.delete(Number(req.params.productId))
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },
}