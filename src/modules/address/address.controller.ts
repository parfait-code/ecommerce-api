import { Request, Response, NextFunction } from 'express'
import { addressService } from './address.service'
import { respond } from '../../shared/utils/response'

export const addressController = {
  validate: (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = addressService.validate(req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await addressService.getAll(req.user!.userId)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await addressService.getById(req.params.addressId as string, req.user!.userId)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await addressService.create(req.user!.userId, req.body)
      respond(res, result, 201)
    } catch (err) {
      next(err)
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await addressService.update(req.params.addressId as string, req.user!.userId, req.body)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await addressService.delete(req.params.addressId as string, req.user!.userId)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },
}