import { prisma } from "../../shared/config/database";
import { categoryRepository } from "../categories/category.repository";
import { paginate } from "../../shared/utils/pagination";
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  CreateDiscountDto,
  CreateCouponDto,
} from "./promotion.schema";

const promotionInclude = {
  discounts: {
    include: {
      category: { select: { id: true, name: true, slug: true } },
      products: {
        include: {
          product: {
            select: { id: true, name: true, images: true, price: true },
          },
        },
      },
    },
  },
  coupons: {
    select: {
      id: true,
      code: true,
      maxUses: true,
      usedCount: true,
      perUserLimit: true,
      startDate: true,
      endDate: true,
      isActive: true,
    },
  },
  _count: { select: { coupons: true, discounts: true } },
};

const affectedProductInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: "asc" as const } },
};

export const promotionRepository = {
  findAll: (query: { isActive?: string }) => {
    const where = {
      ...(query.isActive !== undefined && {
        isActive: query.isActive === "true",
      }),
    };
    return prisma.promotion.findMany({
      where,
      include: promotionInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  findById: (id: string) =>
    prisma.promotion.findUnique({ where: { id }, include: promotionInclude }),

  findBySlug: (slug: string) =>
    prisma.promotion.findUnique({ where: { slug }, include: promotionInclude }),

  existsBySlug: (slug: string) =>
    prisma.promotion.findUnique({ where: { slug } }),

  // ── Pricing ──────────────────────────────────────────────────────────────

  findActiveDiscounts: async () => {
    const now = new Date();
    const discounts = await prisma.discount.findMany({
      where: {
        promotion: {
          isActive: true,
          status: { not: "CANCELLED" },
          startDate: { lte: now },
          endDate: { gte: now },
        },
      },
      include: {
        promotion: {
          select: {
            isActive: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        products: { select: { productId: true } },
      },
    });

    // Pour chaque discount ciblant une catégorie, résout catégorie + tous ses
    // descendants — le pricing doit s'appliquer à toute la sous-arborescence.
    return Promise.all(
      discounts.map(async (d) => {
        if (!d.categoryId)
          return { ...d, applicableCategoryIds: [] as string[] };
        const descendantIds = await categoryRepository.findDescendantIds(
          d.categoryId,
        );
        return {
          ...d,
          applicableCategoryIds: [d.categoryId, ...descendantIds],
        };
      }),
    );
  },

  // ── Produits affectés par une promotion ─────────────────────────────────
  // Fusionne les produits ciblés directement (DiscountProduct) et ceux
  // appartenant aux catégories ciblées (Discount.categoryId), sur TOUS les
  // discounts de la promotion, dédoublonnés. Une promotion sans aucun
  // discount (ex: coupon seul, sans ciblage produit) retourne un tableau vide.
  findAffectedProducts: async (
    promotionId: string,
    query: { page?: string; limit?: string } = {},
  ) => {
    const discounts = await prisma.discount.findMany({
      where: { promotionId },
      select: { categoryId: true, products: { select: { productId: true } } },
    });

    const directCategoryIds = [
      ...new Set(
        discounts
          .map((d) => d.categoryId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const descendantsByCategory = await Promise.all(
      directCategoryIds.map((id) => categoryRepository.findDescendantIds(id)),
    );
    const categoryIds = [
      ...new Set([...directCategoryIds, ...descendantsByCategory.flat()]),
    ];
    const directProductIds = [
      ...new Set(discounts.flatMap((d) => d.products.map((p) => p.productId))),
    ];

    if (categoryIds.length === 0 && directProductIds.length === 0) {
      return [[], 0] as const;
    }

    const where = {
      status: "ACTIVE" as const,
      OR: [
        ...(categoryIds.length > 0
          ? [{ categoryId: { in: categoryIds } }]
          : []),
        ...(directProductIds.length > 0
          ? [{ id: { in: directProductIds } }]
          : []),
      ],
    };

    const { skip, take } = paginate(query);
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        include: affectedProductInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);
    return [items, total] as const;
  },

  create: (data: CreatePromotionDto) =>
    prisma.promotion.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive,
        status: new Date(data.startDate) <= new Date() ? "ACTIVE" : "SCHEDULED",
      },
      include: promotionInclude,
    }),

  update: (id: string, data: UpdatePromotionDto) =>
    prisma.promotion.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: promotionInclude,
    }),

  toggle: (id: string, isActive: boolean) =>
    prisma.promotion.update({
      where: { id },
      data: { isActive },
      include: promotionInclude,
    }),

  updateStatus: (
    id: string,
    status: "SCHEDULED" | "ACTIVE" | "EXPIRED" | "CANCELLED",
  ) => prisma.promotion.update({ where: { id }, data: { status } }),

  delete: (id: string) => prisma.promotion.delete({ where: { id } }),

  addImages: (id: string, images: string[]) =>
    prisma.promotion.update({
      where: { id },
      data: { images: { push: images } },
      include: promotionInclude,
    }),

  removeImage: (id: string, images: string[]) =>
    prisma.promotion.update({
      where: { id },
      data: { images },
      include: promotionInclude,
    }),

  // ── Discounts ──────────────────────────────────────────────────────────────

  createDiscount: async (promotionId: string, data: CreateDiscountDto) => {
    const discount = await prisma.discount.create({
      data: {
        promotionId,
        type: data.type,
        value: data.value,
        categoryId: data.categoryId,
      },
    });

    if (data.productIds && data.productIds.length > 0) {
      await prisma.discountProduct.createMany({
        data: data.productIds.map((productId: string) => ({
          discountId: discount.id,
          productId,
        })),
      });
    }

    return prisma.discount.findUnique({
      where: { id: discount.id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        products: {
          include: {
            product: {
              select: { id: true, name: true, images: true, price: true },
            },
          },
        },
      },
    });
  },

  findDiscountById: (id: string) =>
    prisma.discount.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        products: {
          include: {
            product: { select: { id: true, name: true, price: true } },
          },
        },
      },
    }),

  deleteDiscount: (id: string) => prisma.discount.delete({ where: { id } }),

  // ── Coupons ────────────────────────────────────────────────────────────────

  createCoupon: (promotionId: string, data: CreateCouponDto) =>
    prisma.couponCode.create({
      data: {
        promotionId,
        code: data.code,
        maxUses: data.maxUses,
        perUserLimit: data.perUserLimit,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: data.isActive,
      },
    }),

  findCouponByCode: (code: string) =>
    prisma.couponCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        promotion: {
          include: {
            discounts: {
              include: {
                category: { select: { id: true } },
                products: { select: { productId: true } },
              },
            },
          },
        },
        uses: { select: { userId: true } },
      },
    }),

  findCouponById: (id: string) =>
    prisma.couponCode.findUnique({ where: { id } }),
  findCouponsByPromotion: (
    promotionId: string,
    query: { page?: string; limit?: string } = {},
  ) => {
    const { skip, take } = paginate(query);
    const where = { promotionId };
    return Promise.all([
      prisma.couponCode.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          code: true,
          maxUses: true,
          usedCount: true,
          perUserLimit: true,
          startDate: true,
          endDate: true,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.couponCode.count({ where }),
    ]);
  },

  deleteCoupon: (id: string) => prisma.couponCode.delete({ where: { id } }),

  incrementCouponUsage: (id: string) =>
    prisma.couponCode.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    }),

  createCouponUse: (couponId: string, userId: string, orderId: string) =>
    prisma.couponUse.create({
      data: { couponId, userId, orderId },
    }),
};
