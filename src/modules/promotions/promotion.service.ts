import { PromotionStatus } from "@prisma/client";
import { promotionRepository } from "./promotion.repository";
import { categoryRepository } from "../categories/category.repository";
import { productRepository } from "../products/product.repository";
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  CreateDiscountDto,
  CreateCouponDto,
  ValidateCouponDto,
} from "./promotion.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";
import {
  uploadImage,
  deleteImage as deleteR2Image,
} from "../../shared/utils/upload";
import { businessLogger, auditLogger } from "../../shared/logger";
import {
  computeDisplayStatus,
  computeCouponEffectiveStatus,
  getBestPricing,
} from "./promotion.pricing";

const withDisplayStatus = <
  T extends {
    isActive: boolean;
    status: PromotionStatus;
    startDate: Date;
    endDate: Date;
  },
>(
  promotion: T,
): T => ({
  ...promotion,
  status: computeDisplayStatus(promotion),
});

export const promotionService = {
  getAll: async (query: {
    status?: string;
    isActive?: string;
    page?: string;
    limit?: string;
  }) => {
    const promotions = await promotionRepository.findAll({
      isActive: query.isActive,
    });
    const withStatus = promotions.map(withDisplayStatus);
    const filtered = query.status
      ? withStatus.filter((p) => p.status === query.status)
      : withStatus;

    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const total = filtered.length;
    const items = filtered.slice(
      (page - 1) * limit,
      (page - 1) * limit + limit,
    );

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getActive: async (query: {
    page?: string;
    limit?: string;
    slot?: string;
  }) => {
    const isHeroSlot = query.slot === "hero";

    const promotions = isHeroSlot
      ? await promotionRepository.findFeaturedInHero()
      : await promotionRepository.findAll({ isActive: "true" });

    const active = promotions
      .map(withDisplayStatus)
      .filter((p) => p.status === "ACTIVE")
      .sort((a, b) => {
        if (isHeroSlot) {
          const posA = a.heroPosition ?? Number.MAX_SAFE_INTEGER;
          const posB = b.heroPosition ?? Number.MAX_SAFE_INTEGER;
          if (posA !== posB) return posA - posB;
        }
        return a.endDate.getTime() - b.endDate.getTime();
      });

    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const total = active.length;
    const items = active.slice((page - 1) * limit, (page - 1) * limit + limit);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
  getCoupons: async (
    promotionId: string,
    query: { page?: string; limit?: string } = {},
  ) => {
    const promotion = await promotionRepository.findById(promotionId);
    if (!promotion) throw new AppError("Promotion not found", 404);

    const [coupons, total] = await promotionRepository.findCouponsByPromotion(
      promotionId,
      query,
    );
    const items = coupons.map((c) => ({
      ...c,
      effectiveIsActive: computeCouponEffectiveStatus(c),
    }));

    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getAffectedProducts: async (
    idOrSlug: string,
    bySlug = false,
    includeInactive = false,
    query: { page?: string; limit?: string } = {},
  ) => {
    const promotion = bySlug
      ? await promotionRepository.findBySlug(idOrSlug)
      : await promotionRepository.findById(idOrSlug);
    if (!promotion) throw new AppError("Promotion not found", 404);

    const displayStatus = computeDisplayStatus(promotion);
    if (!includeInactive && displayStatus !== "ACTIVE")
      throw new AppError("Promotion not found", 404);

    const [products, total] = await promotionRepository.findAffectedProducts(
      promotion.id,
      query,
    );
    const activeDiscounts = await promotionRepository.findActiveDiscounts();

    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    const items = products.map((product: any) => ({
      ...product,
      pricing: getBestPricing(product, activeDiscounts as any),
    }));

    return {
      promotionId: promotion.id,
      promotionName: promotion.name,
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  getById: async (id: string) => {
    const promotion = await promotionRepository.findById(id);
    if (!promotion) throw new AppError("Promotion not found", 404);
    return withDisplayStatus(promotion);
  },

  getBySlug: async (slug: string, includeInactive = false) => {
    const promotion = await promotionRepository.findBySlug(slug);
    if (!promotion) throw new AppError("Promotion not found", 404);

    const withStatus = withDisplayStatus(promotion);
    if (!includeInactive && withStatus.status !== "ACTIVE")
      throw new AppError("Promotion not found", 404);

    return withStatus;
  },

  create: async (dto: CreatePromotionDto) => {
    const existingSlug = await promotionRepository.existsBySlug(dto.slug);
    if (existingSlug) throw new AppError("Promotion slug already taken", 409);

    const promotion = await promotionRepository.create(dto);

    businessLogger.log("PROMOTION_CREATED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId: promotion.id },
      metadata: { name: dto.name, slug: dto.slug },
    });

    auditLogger.log("PROMOTION_CREATED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId: promotion.id },
      metadata: { name: dto.name, slug: dto.slug },
    });

    return withDisplayStatus(promotion);
  },

  update: async (id: string, dto: UpdatePromotionDto) => {
    const promotion = await promotionRepository.findById(id);
    if (!promotion) throw new AppError("Promotion not found", 404);

    if (dto.slug && dto.slug !== promotion.slug) {
      const existingSlug = await promotionRepository.existsBySlug(dto.slug);
      if (existingSlug) throw new AppError("Promotion slug already taken", 409);
    }

    const updated = await promotionRepository.update(id, dto);
    await cache.delByPattern("products:*");

    businessLogger.log("PROMOTION_UPDATED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId: id },
      metadata: { fields: Object.keys(dto) },
    });

    return withDisplayStatus(updated);
  },

  toggle: async (id: string) => {
    const promotion = await promotionRepository.findById(id);
    if (!promotion) throw new AppError("Promotion not found", 404);

    const updated = await promotionRepository.toggle(id, !promotion.isActive);
    await cache.delByPattern("products:*");

    businessLogger.log("PROMOTION_TOGGLED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId: id },
      metadata: { isActive: !promotion.isActive },
    });

    auditLogger.log("PROMOTION_TOGGLED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId: id },
      metadata: { isActive: !promotion.isActive },
    });

    return withDisplayStatus(updated);
  },

  delete: async (id: string) => {
    const promotion = await promotionRepository.findById(id);
    if (!promotion) throw new AppError("Promotion not found", 404);

    await promotionRepository.delete(id);
    await cache.delByPattern("products:*");

    businessLogger.log("PROMOTION_DELETED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId: id },
      metadata: { name: promotion.name, slug: promotion.slug },
    });

    auditLogger.log("PROMOTION_DELETED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId: id },
      metadata: { name: promotion.name },
    });

    return { message: "Promotion deleted successfully" };
  },

  uploadImages: async (id: string, files: Express.Multer.File[]) => {
    const promotion = await promotionRepository.findById(id);
    if (!promotion) throw new AppError("Promotion not found", 404);

    const uploadedUrls = await Promise.all(
      files.map((f) => uploadImage(f, "promotions")),
    );

    return promotionRepository.addImages(id, uploadedUrls);
  },

  deleteImage: async (id: string, imageUrl: string) => {
    const promotion = await promotionRepository.findById(id);
    if (!promotion) throw new AppError("Promotion not found", 404);

    if (!promotion.images.includes(imageUrl))
      throw new AppError("Image not found on this promotion", 404);

    await deleteR2Image(imageUrl);
    const remaining = promotion.images.filter((url) => url !== imageUrl);

    return promotionRepository.removeImage(id, remaining);
  },

  createDiscount: async (promotionId: string, dto: CreateDiscountDto) => {
    const promotion = await promotionRepository.findById(promotionId);
    if (!promotion) throw new AppError("Promotion not found", 404);

    if (dto.type === "PERCENTAGE" && dto.value > 100)
      throw new AppError("Percentage discount value cannot exceed 100", 400);

    if (dto.categoryId) {
      const category = await categoryRepository.findById(dto.categoryId);
      if (!category) throw new AppError("Category not found", 404);
    }

    if (dto.productIds) {
      for (const productId of dto.productIds) {
        // includeInactive: true — un admin doit pouvoir cibler un discount
        // sur un produit DRAFT/ARCHIVED (ex: préparer une promo avant activation).
        const product = await productRepository.findById(productId, true);
        if (!product) throw new AppError(`Product ${productId} not found`, 404);
      }
    }

    const discount = await promotionRepository.createDiscount(promotionId, dto);
    await cache.delByPattern("products:*");

    businessLogger.log("DISCOUNT_CREATED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId, discountId: discount!.id },
      metadata: { type: dto.type, value: dto.value },
    });

    auditLogger.log("DISCOUNT_CREATED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId, discountId: discount!.id },
      metadata: { type: dto.type, value: dto.value },
    });

    return discount;
  },

  deleteDiscount: async (promotionId: string, discountId: string) => {
    const discount = await promotionRepository.findDiscountById(discountId);
    if (!discount || discount.promotionId !== promotionId)
      throw new AppError("Discount not found", 404);

    await promotionRepository.deleteDiscount(discountId);
    await cache.delByPattern("products:*");

    businessLogger.log("DISCOUNT_DELETED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId, discountId },
    });

    return { message: "Discount deleted successfully" };
  },

  createCoupon: async (promotionId: string, dto: CreateCouponDto) => {
    const promotion = await promotionRepository.findById(promotionId);
    if (!promotion) throw new AppError("Promotion not found", 404);

    const existingCode = await promotionRepository.findCouponByCode(dto.code);
    if (existingCode) throw new AppError("Coupon code already taken", 409);

    const coupon = await promotionRepository.createCoupon(promotionId, dto);

    businessLogger.log("COUPON_CREATED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId, couponId: coupon.id },
      metadata: { code: coupon.code },
    });

    return coupon;
  },

  deleteCoupon: async (promotionId: string, couponId: string) => {
    const coupon = await promotionRepository.findCouponById(couponId);
    if (!coupon || coupon.promotionId !== promotionId)
      throw new AppError("Coupon not found", 404);

    await promotionRepository.deleteCoupon(couponId);

    businessLogger.log("COUPON_DELETED", {
      service: "promotions",
      actor: { userId: null, role: "ADMIN" },
      target: { promotionId, couponId },
      metadata: { code: coupon.code },
    });

    return { message: "Coupon deleted successfully" };
  },

  validateCoupon: async (dto: ValidateCouponDto, userId: string) => {
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
        const product = await productRepository.findById(item.id);
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
