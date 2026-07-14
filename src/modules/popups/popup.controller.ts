import { Request, Response, NextFunction } from "express";
import { popupService } from "./popup.service";
import { respond } from "../../shared/utils/response";
import { AppError } from "../../shared/utils/app-error";

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

  // ── Nouveau ──────────────────────────────────────────────────────────
  uploadImage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file)
        throw new AppError("No file uploaded (expected field 'image')", 400);
      const result = await popupService.uploadImage(
        req.params.popupId as string,
        file,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  deleteImage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await popupService.deleteImage(
        req.params.popupId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};