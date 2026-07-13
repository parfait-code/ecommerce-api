import { Request, Response, NextFunction } from "express";
import { promotionService } from "./promotion.service";
import { respond } from "../../shared/utils/response";
import { AppError } from "../../shared/utils/app-error";

export const promotionController = {
  // ── Promotions ─────────────────────────────────────────────────────────────

  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.getAll(
        req.query as {
          status?: string;
          isActive?: string;
          page?: string;
          limit?: string;
        },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getActive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.getActive(
        req.query as { page?: string; limit?: string; slot?: string },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getCoupons: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.getCoupons(
        req.params.promotionId as string,
        req.query as { page?: string; limit?: string },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getAffectedProducts: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await promotionService.getAffectedProducts(
        req.params.promotionId as string,
        false,
        true,
        req.query as { page?: string; limit?: string },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getAffectedProductsBySlug: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const isAdmin = req.user?.role === "ADMIN";
      const includeInactive = isAdmin && req.query.includeInactive === "true";
      const result = await promotionService.getAffectedProducts(
        req.params.slug as string,
        true,
        includeInactive,
        req.query as { page?: string; limit?: string },
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.getById(
        req.params.promotionId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getBySlug: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user?.role === "ADMIN";
      const includeInactive = isAdmin && req.query.includeInactive === "true";
      const result = await promotionService.getBySlug(
        req.params.slug as string,
        includeInactive,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.create(req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.update(
        req.params.promotionId as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  toggle: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.toggle(
        req.params.promotionId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.delete(
        req.params.promotionId as string,
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
      const result = await promotionService.uploadImages(
        req.params.promotionId as string,
        files,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  deleteImage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { imageUrl } = req.body;
      if (!imageUrl) throw new AppError("imageUrl is required", 400);
      const result = await promotionService.deleteImage(
        req.params.promotionId as string,
        imageUrl,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  // ── Discounts ──────────────────────────────────────────────────────────────

  createDiscount: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.createDiscount(
        req.params.promotionId as string,
        req.body,
      );
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  deleteDiscount: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.deleteDiscount(
        req.params.promotionId as string,
        req.params.discountId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  // ── Coupons ────────────────────────────────────────────────────────────────

  createCoupon: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.createCoupon(
        req.params.promotionId as string,
        req.body,
      );
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  deleteCoupon: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.deleteCoupon(
        req.params.promotionId as string,
        req.params.couponId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  validateCoupon: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.validateCoupon(
        req.body,
        req.user!.userId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
