import { Request, Response, NextFunction } from "express";
import { orderService } from "./order.service";
import { respond } from "../../shared/utils/response";

export const orderController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN";
      const result = await orderService.getAll(
        req.query as Record<string, string>,
        req.user!.userId,
        isAdmin,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN";
      const result = await orderService.getById(
        req.params.orderId as string,
        req.user!.userId,
        isAdmin,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getByUser: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await orderService.getByUser(
        req.params.userId as string,
        req.query as Record<string, string>,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  expireStale: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const expiredCount = await orderService.expireStalePending();
      respond(res, { expiredCount });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await orderService.create(req.user!.userId, req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN";
      const result = await orderService.update(
        req.params.orderId as string,
        req.body,
        req.user!.userId,
        isAdmin,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  updateStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await orderService.updateStatus(
        req.params.orderId as string,
        req.body,
        req.user!.userId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN";
      const result = await orderService.delete(
        req.params.orderId as string,
        req.user!.userId,
        isAdmin,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
