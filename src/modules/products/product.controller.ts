import { Request, Response, NextFunction } from "express";
import { productService } from "./product.service";
import { respond } from "../../shared/utils/response";
import { AppError } from "../../shared/utils/app-error";

export const productController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user?.role === "ADMIN";
      const includeInactive = isAdmin && req.query.includeInactive === "true";
      const result = await productService.getAll(
        req.query as {
          page?: string;
          limit?: string;
          categoryId?: string;
          search?: string;
        },
        includeInactive,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user?.role === "ADMIN";
      const includeInactive = isAdmin && req.query.includeInactive === "true";
      const result = await productService.getById(
        req.params.productId as string,
        includeInactive,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.create(req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.update(
        req.params.productId as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.delete(
        req.params.productId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  uploadImages: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0)
        throw new AppError("No files uploaded", 400);
      const combinationId = req.body.combinationId as string | undefined;
      const result = await productService.uploadImages(
        req.params.productId as string,
        files,
        combinationId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  deleteImage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { imageId } = req.body;
      if (!imageId) throw new AppError("imageId is required", 400);
      const result = await productService.deleteImage(
        req.params.productId as string,
        imageId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
