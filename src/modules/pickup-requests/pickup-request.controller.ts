import { Request, Response, NextFunction } from "express";
import { pickupRequestService } from "./pickup-request.service";
import { respond } from "../../shared/utils/response";

export const pickupRequestController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pickupRequestService.getAll(
        req.query as {
          page?: string;
          limit?: string;
          status?: string;
          order_id?: string;
        },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN";
      const result = await pickupRequestService.getById(
        req.params.requestId as string,
        req.user!.userId,
        isAdmin,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  updateLocation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pickupRequestService.updateLocation(
        req.params.requestId as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  updateStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pickupRequestService.updateStatus(
        req.params.requestId as string,
        req.body,
        req.user!.userId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  expireOverdue: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const expiredCount = await pickupRequestService.expireOverdue();
      respond(res, { expiredCount });
    } catch (err) {
      next(err);
    }
  },
};
