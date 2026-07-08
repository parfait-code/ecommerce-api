import { Request, Response, NextFunction } from "express";
import { categoryService } from "./category.service";
import { respond } from "../../shared/utils/response";
import { AppError } from "../../shared/utils/app-error";

export const categoryController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeInactive =
        req.user?.role === "ADMIN" && req.query.includeInactive === "true";
      const result = await categoryService.getAll(includeInactive);
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user?.role === "ADMIN";
      const includeInactive = isAdmin && req.query.includeInactive === "true";
      const result = await categoryService.getById(
        req.params.categoryId as string,
        includeInactive,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getBySlug: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await categoryService.getBySlug(req.params.slug as string);
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getProducts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user?.role === "ADMIN";
      const includeInactive = isAdmin && req.query.includeInactive === "true";
      const result = await categoryService.getProducts(
        req.params.slug as string,
        req.query as { page?: string; limit?: string },
        includeInactive,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await categoryService.update(
        req.params.categoryId as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await categoryService.delete(
        req.params.categoryId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await categoryService.create(req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  // ── Upload image / icône ────────────────────────────────────────────────────
  uploadAssets: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as
        | {
            image?: Express.Multer.File[];
            icon?: Express.Multer.File[];
          }
        | undefined;

      if (!files || (!files.image?.length && !files.icon?.length)) {
        throw new AppError(
          "No files uploaded (expected field 'image' and/or 'icon')",
          400,
        );
      }

      const result = await categoryService.uploadAssets(
        req.params.categoryId as string,
        files,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  deleteImage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await categoryService.deleteAsset(
        req.params.categoryId as string,
        "image",
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  deleteIcon: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await categoryService.deleteAsset(
        req.params.categoryId as string,
        "icon",
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
