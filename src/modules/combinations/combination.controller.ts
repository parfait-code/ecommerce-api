import { Request, Response, NextFunction } from "express";
import { combinationService } from "./combination.service";
import { respond } from "../../shared/utils/response";

export const combinationController = {
  setOptionsForAttribute: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await combinationService.setOptionsForAttribute(
        req.params.productId as string,
        req.params.attributeDefinitionId as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getSelections: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await combinationService.getSelections(
        req.params.productId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  generate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await combinationService.generate(
        req.params.productId as string,
      );
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },
  getByProduct: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user?.role === "ADMIN";
      const includeInactive = isAdmin && req.query.includeInactive === "true";
      const result = await combinationService.getByProduct(
        req.params.productId as string,
        includeInactive,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await combinationService.getById(
        req.params.combinationId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await combinationService.update(
        req.params.combinationId as string,
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
      const result = await combinationService.delete(
        req.params.combinationId as string,
        req.params.productId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
