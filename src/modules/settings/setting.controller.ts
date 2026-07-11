import { Request, Response, NextFunction } from "express";
import { settingService } from "./setting.service";
import { respond } from "../../shared/utils/response";

export const settingController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = req.query.category as string | undefined;
      const result = await settingService.getAll(category);
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getPublic: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await settingService.getPublic();
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await settingService.update(
        req.params.key as string,
        req.body.value,
        req.user!.userId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  updateMany: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await settingService.updateMany(
        req.body.settings,
        req.user!.userId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
