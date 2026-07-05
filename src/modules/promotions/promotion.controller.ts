import { Request, Response, NextFunction } from "express";
import { promotionService } from "./promotion.service";
import { promotionRepository } from "./promotion.repository";
import { respond } from "../../shared/utils/response";
import { AppError } from "../../shared/utils/app-error";
import { productRepository } from "../products/product.repository";
import { getBestPricing } from "./promotion.pricing";
import { ValidateCouponDto } from "./promotion.schema";

export const promotionController = {
  // ── Promotions ─────────────────────────────────────────────────────────────

  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await promotionService.getAll(
        req.query as { status?: string; isActive?: string },
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
      const result = await promotionService.getBySlug(
        req.params.slug as string,
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
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  // ── Produits affectés ────────────────────────────────────────────────────
  getAffectedProducts: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await promotionService.getAffectedProducts(
        req.params.promotionId as string,
        false,
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
      const result = await promotionService.getAffectedProducts(
        req.params.slug as string,
        true,
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

  validateCoupon: async (dto: ValidateCouponDto, userId: number) => {
    const coupon = await promotionRepository.findCouponByCode(dto.code);
    if (!coupon) throw new AppError("Invalid coupon code", 404);
    if (!coupon.isActive) throw new AppError("This coupon is not active", 400);
    if (!coupon.promotion.isActive)
      throw new AppError(
        "The promotion linked to this coupon is not active",
        400,
      );

    const now = new Date();
    if (coupon.startDate && now < coupon.startDate)
      throw new AppError("This coupon is not yet valid", 400);
    if (coupon.endDate && now > coupon.endDate)
      throw new AppError("This coupon has expired", 400);
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
      throw new AppError(
        "This coupon has reached its maximum usage limit",
        400,
      );

    const userUseCount = coupon.uses.filter((u) => u.userId === userId).length;
    if (userUseCount >= coupon.perUserLimit)
      throw new AppError(
        "You have already used this coupon the maximum number of times",
        400,
      );

    // ── Preview optionnel : calcule le total réel si items fourni ──
    let preview:
      | {
          totalAmount: number;
          meetsMinimum: boolean;
          minOrderAmount: number | null;
        }
      | undefined;

    if (dto.items && dto.items.length > 0) {
      const activeDiscounts = await promotionRepository.findActiveDiscounts();
      let totalAmount = 0;

      for (const item of dto.items) {
        const product = await productRepository.findById(Number(item.id));
        if (!product) continue;
        const pricing = getBestPricing(product, activeDiscounts as any);
        totalAmount += pricing.finalPrice * item.quantity;
      }
      totalAmount = Math.round(totalAmount * 100) / 100;

      const meetsMinimum =
        coupon.minOrderAmount === null || totalAmount >= coupon.minOrderAmount;

      preview = {
        totalAmount,
        meetsMinimum,
        minOrderAmount: coupon.minOrderAmount,
      };

      if (!meetsMinimum) {
        throw new AppError(
          `This coupon requires a minimum order amount of ${coupon.minOrderAmount}`,
          400,
        );
      }
    }

    return {
      valid: true as const,
      couponId: coupon.id,
      code: coupon.code,
      promotion: {
        id: coupon.promotion.id,
        name: coupon.promotion.name,
        slug: coupon.promotion.slug,
      },
      discounts: coupon.promotion.discounts,
      ...(preview && { preview }),
    };
  },
};
