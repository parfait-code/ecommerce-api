import { Request, Response, NextFunction } from "express";
import { popupService } from "./popup.service";
import { respond } from "../../shared/utils/response";

export const popupController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await popupService.getAll(
        req.query as { isActive?: string; targetType?: string },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getActive: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await popupService.getActive();
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await popupService.getById(req.params.popupId as string);
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await popupService.create(req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await popupService.update(
        req.params.popupId as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await popupService.delete(req.params.popupId as string);
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
