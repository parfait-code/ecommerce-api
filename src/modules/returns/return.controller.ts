import { Request, Response, NextFunction } from "express";
import { returnService } from "./return.service";
import { respond } from "../../shared/utils/response";

export const returnController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await returnService.getAll(
        req.query as { status?: string; page?: string; limit?: string },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN";
      const result = await returnService.getById(
        req.params.returnId as string,
        req.user!.userId,
        isAdmin,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getByOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN";
      const result = await returnService.getByOrder(
        req.params.orderId as string,
        req.user!.userId,
        isAdmin,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await returnService.create(req.user!.userId, req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  updateStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await returnService.updateStatus(
        req.params.returnId as string,
        req.body,
        req.user!.userId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
