import { Request, Response, NextFunction } from "express";
import { shippingMethodService } from "./shipping-method.service";
import { respond } from "../../shared/utils/response";

export const shippingMethodController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const onlyActive = req.query.active === "true";
      respond(res, await shippingMethodService.getAll(onlyActive));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(
        res,
        await shippingMethodService.getById(req.params.methodId as string),
      );
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(res, await shippingMethodService.create(req.body), 201);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(
        res,
        await shippingMethodService.update(
          req.params.methodId as string,
          req.body,
        ),
      );
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(
        res,
        await shippingMethodService.delete(req.params.methodId as string),
      );
    } catch (err) {
      next(err);
    }
  },

  calculate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(res, await shippingMethodService.calculate(req.body));
    } catch (err) {
      next(err);
    }
  },
};
