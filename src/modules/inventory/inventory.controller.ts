import { Request, Response, NextFunction } from 'express'
import { inventoryService } from './inventory.service'
import { respond } from '../../shared/utils/response'

export const inventoryController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.getAll(
      req.query as { category?: string; location?: string; page?: string; limit?: string },
    )
    respond(res, result)
  } catch (err) {
    next(err)
  }
},

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.getById(req.params.item_id as string)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  getLowStock: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const threshold = Number(req.query.threshold ?? 10)
      const result = await inventoryService.getLowStock(threshold)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  getOutOfStock: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.getOutOfStock()
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  search: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyword = req.query.keyword as string
      if (!keyword) throw new Error('keyword is required')
      const result = await inventoryService.search(keyword)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.create(req.body)
      respond(res, result, 201)
    } catch (err) {
      next(err)
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.update(req.params.item_id as string, req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.delete(req.params.item_id as string)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  transfer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.transfer(req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },
}