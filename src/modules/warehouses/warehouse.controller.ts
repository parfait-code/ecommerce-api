import { Request, Response, NextFunction } from "express";
import { warehouseService } from "./warehouse.service";
import { respond } from "../../shared/utils/response";

export const warehouseController = {
  getAll: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await warehouseService.getAll();
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await warehouseService.getById(
        req.params.warehouse_id as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getInventory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await warehouseService.getInventory(
        req.params.warehouse_id as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
  
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await warehouseService.create(req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await warehouseService.update(
        req.params.warehouse_id as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await warehouseService.delete(
        req.params.warehouse_id as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
