import { prisma } from "../../shared/config/database";
import {
  ProductStatus,
  OrderStatus,
  UserRole,
  ReturnStatus,
} from "@prisma/client";

export const dashboardRepository = {
  // ── Products ────────────────────────────────────────────────────────────
  countAllProducts: () => prisma.product.count(),

  countProductsByStatus: () =>
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),

  countProductsCreatedSince: (since: Date) =>
    prisma.product.count({ where: { createdAt: { gte: since } } }),

  // ── Orders ──────────────────────────────────────────────────────────────
  countAllOrders: () => prisma.order.count(),

  countOrdersByStatus: () =>
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),

  countOrdersCreatedBetween: (start: Date, end?: Date) =>
    prisma.order.count({
      where: { createdAt: end ? { gte: start, lt: end } : { gte: start } },
    }),

  // ── Users ───────────────────────────────────────────────────────────────
  countTotalUsers: () => prisma.user.count({ where: { deletedAt: null } }),

  countActiveUsers: () =>
    prisma.user.count({ where: { deletedAt: null, isActive: true } }),

  countNewUsersSince: (since: Date) =>
    prisma.user.count({
      where: { deletedAt: null, createdAt: { gte: since } },
    }),

  countUsersByRole: () =>
    prisma.user.groupBy({
      where: { deletedAt: null },
      by: ["role"],
      _count: { _all: true },
    }),

  // ── Payments ────────────────────────────────────────────────────────────
  sumCompletedPayments: (start?: Date, end?: Date) =>
    prisma.payment.aggregate({
      where: {
        status: "COMPLETED",
        ...(start && {
          createdAt: end ? { gte: start, lt: end } : { gte: start },
        }),
      },
      _sum: { amount: true },
    }),

  countPendingCodPayments: () =>
    prisma.payment.count({
      where: { method: "CASH_ON_DELIVERY", status: "PENDING" },
    }),

  // ── Inventory — agrégé PAR PRODUIT (somme toutes lignes confondues),
  // pas par ligne, pour éviter de fausser le compte low/out of stock. ──────
  stockSumByProduct: () =>
    prisma.inventory.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
    }),

  // ── Shipments ───────────────────────────────────────────────────────────
  countShipmentsInTransit: () =>
    prisma.shipment.count({ where: { status: "IN_TRANSIT" } }),

  countShipmentsCreatedBetween: (start: Date, end: Date) =>
    prisma.shipment.count({ where: { createdAt: { gte: start, lt: end } } }),

  countPendingPickupRequests: () =>
    prisma.pickupRequest.count({ where: { status: "PENDING" } }),

  // ── Promotions — champs minimaux nécessaires à computeDisplayStatus,
  // recalculé côté service (jamais fiable depuis le champ status stocké). ──
  findPromotionsForStatusCheck: () =>
    prisma.promotion.findMany({
      where: { isActive: true, status: { not: "CANCELLED" } },
      select: { isActive: true, status: true, startDate: true, endDate: true },
    }),

  sumCouponUsageSince: (since: Date) =>
    prisma.couponCode.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { usedCount: true },
    }),

  sumRevenueFromCouponsSince: (since: Date) =>
    prisma.payment.aggregate({
      where: {
        createdAt: { gte: since },
        status: "COMPLETED",
        order: { couponCodeId: { not: null } },
      },
      _sum: { amount: true },
    }),

  // ── Returns ─────────────────────────────────────────────────────────────
  countReturnsByStatus: (status: ReturnStatus) =>
    prisma.returnRequest.count({ where: { status } }),

  countReturnsCreatedSince: (since: Date) =>
    prisma.returnRequest.count({ where: { createdAt: { gte: since } } }),

  // ── Reviews ─────────────────────────────────────────────────────────────
  reviewStats: () =>
    prisma.review.aggregate({
      _count: { _all: true },
      _avg: { rating: true },
    }),

  // ── Sales chart ─────────────────────────────────────────────────────────
  salesPointsForMonth: (start: Date, end: Date) =>
    Promise.all([
      prisma.payment.aggregate({
        where: { createdAt: { gte: start, lt: end }, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: start, lt: end } } }),
    ]),
};

// ── Helpers de reconstruction des dictionnaires (valeurs à 0 par défaut,
// pour que le frontend n'ait jamais de clé manquante même si un statut
// n'a aucune occurrence). ──────────────────────────────────────────────────

export const buildStatusDict = <K extends string>(
  keys: readonly K[],
  grouped: { _count: { _all: number } }[],
  field: string,
): Record<K, number> => {
  const dict = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of grouped as any[]) {
    dict[row[field] as K] = row._count._all;
  }
  return dict;
};

export const PRODUCT_STATUSES = Object.values(ProductStatus);
export const ORDER_STATUSES = Object.values(OrderStatus);
export const USER_ROLES = Object.values(UserRole);
