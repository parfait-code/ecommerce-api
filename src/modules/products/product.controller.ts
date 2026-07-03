import { Request, Response, NextFunction } from "express";
import { productService } from "./product.service";
import { respond } from "../../shared/utils/response";
import { AppError } from "../../shared/utils/app-error";

export const productController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.getAll(
        req.query as {
          page?: string;
          limit?: string;
          categoryId?: string;
          search?: string;
        },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.getById(Number(req.params.productId));
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
        Number(req.params.productId),
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productService.delete(Number(req.params.productId));
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
        Number(req.params.productId),
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
        Number(req.params.productId),
        imageId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
