import { Request, Response, NextFunction } from "express";
import { loyaltyService } from "./loyalty.service";
import { respond } from "../../shared/utils/response";

export const loyaltyController = {
  getBalance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(res, await loyaltyService.getBalance(Number(req.params.userId)));
    } catch (err) {
      next(err);
    }
  },

  getHistory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(res, await loyaltyService.getHistory(Number(req.params.userId)));
    } catch (err) {
      next(err);
    }
  },

  adjust: async (req: Request, res: Response, next: NextFunction) => {
    try {
      respond(res, await loyaltyService.adjust(req.body), 201);
    } catch (err) {
      next(err);
    }
  },
};
