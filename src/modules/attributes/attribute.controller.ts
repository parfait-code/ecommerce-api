import { Request, Response, NextFunction } from "express";
import { attributeService } from "./attribute.service";
import { respond } from "../../shared/utils/response";

export const attributeController = {
  getByCategory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await attributeService.getByCategory(
        req.params.categoryId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getDefinitionById: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await attributeService.getDefinitionById(
        req.params.definitionId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  createDefinition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await attributeService.createDefinition(
        req.params.categoryId as string,
        req.body,
      );
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  updateDefinition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await attributeService.updateDefinition(
        req.params.definitionId as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  deleteDefinition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await attributeService.deleteDefinition(
        req.params.definitionId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  createOption: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await attributeService.createOption(
        req.params.definitionId as string,
        req.body,
      );
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  updateOption: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await attributeService.updateOption(
        req.params.optionId as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  deleteOption: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await attributeService.deleteOption(
        req.params.optionId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  setProductAttributes: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await attributeService.setProductAttributes(
        Number(req.params.productId),
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
