import { Request, Response, NextFunction } from "express";
import { tagService } from "./tag.service";
import { respond } from "../../shared/utils/response";

export const tagController = {
  getAll: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      respond(res, await tagService.getAll());
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(res, await tagService.getById(req.params.tagId as string));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(res, await tagService.create(req.body), 201);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(
        res,
        await tagService.update(req.params.tagId as string, req.body),
      );
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(res, await tagService.delete(req.params.tagId as string));
    } catch (err) {
      next(err);
    }
  },

  setProductTags: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(
        res,
        await tagService.setProductTags(
          req.params.productId as string,
          req.body,
        ),
      );
    } catch (err) {
      next(err);
    }
  },

  getByProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user?.role === "ADMIN";
      const includeInactive = isAdmin && req.query.includeInactive === "true";
      respond(
        res,
        await tagService.getByProduct(
          req.params.productId as string,
          includeInactive,
        ),
      );
    } catch (err) {
      next(err);
    }
  },
};
