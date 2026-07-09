import { Request, Response, NextFunction } from "express";
import { paymentService } from "./payment.service";
import { respond } from "../../shared/utils/response";

export const paymentController = {
  getMethods: (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = paymentService.getAvailableMethods();
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  complete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.complete(
        req.params.payment_id as string,
        req.user!.userId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  updateStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.updateStatus(
        req.params.payment_id as string,
        req.body,
        req.user!.userId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.create(req.user!.userId, req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.getAll(
        req.query as Record<string, string>,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN";
      const result = await paymentService.getById(
        req.params.payment_id as string,
        req.user!.userId,
        isAdmin,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getByOrderId: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN";
      const result = await paymentService.getByOrderId(
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
