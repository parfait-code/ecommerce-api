import { Request, Response, NextFunction } from 'express'
import { basketService } from './basket.service'
import { respond } from '../../shared/utils/response'

export const basketController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await basketService.create(req.user!.userId)
      respond(res, result, 201)
    } catch (err) {
      next(err)
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await basketService.getById(req.params.basket_id as string)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  addProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await basketService.addProduct(req.params.basket_id as string, req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  updateQuantity: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await basketService.updateQuantity(req.params.basket_id as string, req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  removeProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await basketService.removeProduct(req.params.basket_id as string, req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },
}