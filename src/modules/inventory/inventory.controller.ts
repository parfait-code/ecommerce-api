import { Request, Response, NextFunction } from "express";
import { inventoryService } from "./inventory.service";
import { respond } from "../../shared/utils/response";
import { AppError } from "../../shared/utils/app-error";

export const inventoryController = {
  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.getAll(
        req.query as {
          category?: string;
          location?: string;
          warehouse_id?: string;
          page?: string;
          limit?: string;
        },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.getById(
        req.params.item_id as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getGrouped: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.getGrouped(
        req.query as {
          category?: string;
          warehouse_id?: string;
          low_stock?: string;
          out_of_stock?: string;
          page?: string;
          limit?: string;
        },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getProductLines: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.getProductLines(
        Number(req.params.productId),
        req.query as { page?: string; limit?: string },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  search: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keyword = req.query.keyword as string;
      if (!keyword) throw new AppError("keyword is required", 400);
      const result = await inventoryService.search(
        keyword,
        req.query as { page?: string; limit?: string },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.create(req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.update(
        req.params.item_id as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.delete(
        req.params.item_id as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  transfer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.transfer(req.body);
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
