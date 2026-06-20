import { Request, Response, NextFunction } from "express";
import { variantService } from "./variant.service";
import { respond } from "../../shared/utils/response";

export const variantController = {
  getByProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await variantService.getByProduct(
        Number(req.params.productId),
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await variantService.getById(
        req.params.variantId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await variantService.create(
        Number(req.params.productId),
        req.body,
      );
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await variantService.update(
        req.params.variantId as string,
        Number(req.params.productId),
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await variantService.delete(
        req.params.variantId as string,
        Number(req.params.productId),
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
