import {
  dashboardRepository,
  buildStatusDict,
  PRODUCT_STATUSES,
  ORDER_STATUSES,
  USER_ROLES,
} from "./dashboard.repository";
import { computeDisplayStatus } from "../promotions/promotion.pricing";

const calcTrend = (current: number, previous: number) =>
  previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100);

const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

const LOW_STOCK_THRESHOLD = 10; // cohérent avec inventory.service.ts / inventory.listeners.ts

export const dashboardService = {
  getStats: async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalProducts,
      productsByStatusRaw,
      addedThisMonth,

      totalOrders,
      ordersByStatusRaw,
      ordersThisMonth,
      ordersLastMonth,

      totalUsers,
      activeUsers,
      newUsersThisMonth,
      usersByRoleRaw,

      paymentsThisMonth,
      paymentsLastMonth,
      paymentsAllTime,
      pendingCodCount,

      stockByProduct,
      neverStockedActiveCount,

      shipmentsInProgress,
      shipmentsThisMonth,
      shipmentsLastMonth,
      pendingPickupRequests,

      promotionsForStatusCheck,
      couponUsageThisMonth,
      revenueFromCoupons,

      returnsPending,
      returnsThisMonth,

      reviewAgg,
    ] = await Promise.all([
      dashboardRepository.countAllProducts(),
      dashboardRepository.countProductsByStatus(),
      dashboardRepository.countProductsCreatedSince(startOfMonth),

      dashboardRepository.countAllOrders(),
      dashboardRepository.countOrdersByStatus(),
      dashboardRepository.countOrdersCreatedBetween(startOfMonth),
      dashboardRepository.countOrdersCreatedBetween(
        startOfLastMonth,
        startOfMonth,
      ),

      dashboardRepository.countTotalUsers(),
      dashboardRepository.countActiveUsers(),
      dashboardRepository.countNewUsersSince(startOfMonth),
      dashboardRepository.countUsersByRole(),

      dashboardRepository.sumCompletedPayments(startOfMonth),
      dashboardRepository.sumCompletedPayments(startOfLastMonth, startOfMonth),
      dashboardRepository.sumCompletedPayments(),
      dashboardRepository.countPendingCodPayments(),

      dashboardRepository.stockSumByProduct(),
      dashboardRepository.countActiveProductsWithoutInventory(),

      dashboardRepository.countShipmentsInTransit(),
      dashboardRepository.countShipmentsCreatedBetween(startOfMonth, now),
      dashboardRepository.countShipmentsCreatedBetween(
        startOfLastMonth,
        startOfMonth,
      ),
      dashboardRepository.countPendingPickupRequests(),

      dashboardRepository.findPromotionsForStatusCheck(),
      dashboardRepository.sumCouponUsageSince(startOfMonth),
      dashboardRepository.sumRevenueFromCouponsSince(startOfMonth),

      dashboardRepository.countReturnsByStatus("PENDING"),
      dashboardRepository.countReturnsCreatedSince(startOfMonth),

      dashboardRepository.reviewStats(),
    ]);

    // ── Corrigé — promotions.active ne peut pas se fier au champ `status`
    // stocké (figé à la création/au dernier toggle manuel) : recalcul via
    // computeDisplayStatus, comme le fait déjà promotion.service.ts à la lecture.
    const activePromotionsCount = promotionsForStatusCheck.filter(
      (p) => computeDisplayStatus(p) === "ACTIVE",
    ).length;

    // ── Corrigé — agrégation PAR PRODUIT (somme de toutes les lignes
    // d'inventaire), pas par ligne individuelle, pour un compte low/out of
    // stock qui reflète le stock réel disponible d'un produit.
    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const row of stockByProduct) {
      const total = row._sum.quantity ?? 0;
      if (total === 0) outOfStockCount++;
      else if (total <= LOW_STOCK_THRESHOLD) lowStockCount++;
    }

    // Corrigé — un produit ACTIVE jamais stocké (aucune ligne Inventory)
    // n'apparaît pas dans stockByProduct et était donc invisible du compte
    // ci-dessus. On le traite comme rupture de stock, cas le plus grave.
    outOfStockCount += neverStockedActiveCount;

    const paymentAmountThisMonth = paymentsThisMonth._sum.amount ?? 0;
    const paymentAmountLastMonth = paymentsLastMonth._sum.amount ?? 0;

    return {
      products: {
        total: totalProducts,
        byStatus: buildStatusDict(
          PRODUCT_STATUSES,
          productsByStatusRaw,
          "status",
        ),
        addedThisMonth,
      },
      orders: {
        total: totalOrders,
        byStatus: buildStatusDict(ORDER_STATUSES, ordersByStatusRaw, "status"),
        thisMonth: ordersThisMonth,
        trend: calcTrend(ordersThisMonth, ordersLastMonth),
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisMonth: newUsersThisMonth,
        byRole: buildStatusDict(USER_ROLES, usersByRoleRaw, "role"),
      },
      payments: {
        totalAmountThisMonth: paymentAmountThisMonth,
        totalAmountAllTime: paymentsAllTime._sum.amount ?? 0,
        currency: "XAF",
        trend: calcTrend(paymentAmountThisMonth, paymentAmountLastMonth),
        pendingCodCount,
      },
      inventory: {
        lowStockCount,
        outOfStockCount,
      },
      shipments: {
        inProgress: shipmentsInProgress,
        trend: calcTrend(shipmentsThisMonth, shipmentsLastMonth),
        pendingPickupRequests,
      },
      promotions: {
        active: activePromotionsCount,
        couponUsageThisMonth: couponUsageThisMonth._sum.usedCount ?? 0,
        revenueFromCouponsThisMonth: revenueFromCoupons._sum.amount ?? 0,
        currency: "XAF",
      },
      returns: {
        pending: returnsPending,
        thisMonth: returnsThisMonth,
      },
      reviews: {
        total: reviewAgg._count._all,
        averageRating: reviewAgg._avg.rating
          ? Math.round(reviewAgg._avg.rating * 10) / 10
          : 0,
      },
    };
  },

  getSalesChart: async (query: { year?: string; period?: string }) => {
    const year = Number(query.year ?? new Date().getFullYear());
    const period = query.period ?? "monthly";

    const points = await Promise.all(
      MONTH_LABELS.map(async (label, index) => {
        const start = new Date(year, index, 1);
        const end = new Date(year, index + 1, 1);

        const [agg, orderCount] = await dashboardRepository.salesPointsForMonth(
          start,
          end,
        );

        return {
          label,
          amount: agg._sum.amount ?? 0,
          orderCount,
        };
      }),
    );

    return { period, year, points, currency: "XAF" };
  },
};
