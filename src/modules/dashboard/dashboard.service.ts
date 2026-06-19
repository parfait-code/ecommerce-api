import { prisma } from "../../shared/config/database";

export const dashboardService = {
  getStats: async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalProducts,
      addedThisMonth,
      totalOrders,
      ordersThisMonth,
      ordersLastMonth,
      totalUsers,
      paymentsThisMonth,
      paymentsLastMonth,
      lowStockCount,
      shipmentsInProgress,
      shipmentsLastMonth,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count({
        where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      }),
      prisma.user.count(),
      prisma.payment.aggregate({
        where: { createdAt: { gte: startOfMonth }, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
          status: "COMPLETED",
        },
        _sum: { amount: true },
      }),
      prisma.inventory.count({ where: { quantity: { lte: 10, gt: 0 } } }),
      prisma.shipment.count({ where: { status: "IN_TRANSIT" } }),
      prisma.shipment.count({
        where: {
          status: "IN_TRANSIT",
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
      }),
      prisma.promotion.count({ where: { isActive: true, status: "ACTIVE" } }),
      prisma.couponCode.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { usedCount: true },
      }),
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: startOfMonth },
          status: "COMPLETED",
          order: { couponCodeId: { not: null } },
        },
        _sum: { amount: true },
      }),
    ]);

    const calcTrend = (current: number, previous: number) =>
      previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100);

    const paymentAmountThisMonth = paymentsThisMonth._sum.amount ?? 0;
    const paymentAmountLastMonth = paymentsLastMonth._sum.amount ?? 0;

    return {
      products: {
        total: totalProducts,
        addedThisMonth,
      },
      orders: {
        total: totalOrders,
        thisMonth: ordersThisMonth,
        trend: calcTrend(ordersThisMonth, ordersLastMonth),
      },
      users: {
        total: totalUsers,
        active: totalUsers,
      },
      payments: {
        totalAmountThisMonth: paymentAmountThisMonth,
        currency: "XAF",
        trend: calcTrend(paymentAmountThisMonth, paymentAmountLastMonth),
      },
      inventory: {
        lowStockCount,
      },
      shipments: {
        inProgress: shipmentsInProgress,
        trend: calcTrend(shipmentsInProgress, shipmentsLastMonth),
      },
    };
  },

  getSalesChart: async (query: { year?: string; period?: string }) => {
    const year = Number(query.year ?? new Date().getFullYear());
    const period = query.period ?? "monthly";

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

    const points = await Promise.all(
      MONTH_LABELS.map(async (label, index) => {
        const start = new Date(year, index, 1);
        const end = new Date(year, index + 1, 1);

        const [agg, orderCount] = await Promise.all([
          prisma.payment.aggregate({
            where: {
              createdAt: { gte: start, lt: end },
              status: "COMPLETED",
            },
            _sum: { amount: true },
          }),
          prisma.order.count({
            where: { createdAt: { gte: start, lt: end } },
          }),
        ]);

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
