import { Request, Response, NextFunction } from "express";
import { wishlistService } from "./wishlist.service";
import { respond } from "../../shared/utils/response";

export const wishlistController = {
  getByUser: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await wishlistService.getByUser(req.user!.userId);
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  addItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await wishlistService.addItem(req.user!.userId, req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  removeItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await wishlistService.removeItem(
        req.user!.userId,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
