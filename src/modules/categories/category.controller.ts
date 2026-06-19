import { Request, Response, NextFunction } from "express";
import { categoryService } from "./category.service";
import { respond } from "../../shared/utils/response";

export const categoryController = {
  getAll: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await categoryService.getAll();
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await categoryService.getById(
        req.params.categoryId as string,
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
      const result = await categoryService.getProducts(
        req.params.slug as string,
        req.query as { page?: string; limit?: string },
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
};
