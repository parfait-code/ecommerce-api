import { prisma } from "../../shared/config/database";
import { CreateOrderDto, UpdateOrderDto } from "./order.schema";
import { OrderStatus } from "@prisma/client";
import { AppError } from "../../shared/utils/app-error";
import { paginate } from "../../shared/utils/pagination";

const orderInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, weight: true } },
      combination: {
        select: {
          id: true,
          sku: true,
          price: true,
          values: {
            include: {
              attributeDefinition: {
                select: { id: true, name: true, slug: true },
              },
              attributeOption: {
                select: { id: true, value: true, colorHex: true },
              },
            },
          },
        },
      },
      reviews: {
        select: { id: true, rating: true, comment: true, createdAt: true },
      },
    },
  },
  user: {
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
  appliedCoupon: {
    select: {
      id: true,
      code: true,
      promotion: { select: { id: true, name: true, slug: true } },
    },
  },
  shippingMethod: { select: { id: true, name: true, estimatedDays: true } },
  statusHistory: { orderBy: { createdAt: "desc" as const }, take: 10 },
};

export const orderRepository = {
  findAll: (
    query: {
      status?: string;
      customer?: string;
      page?: string;
      limit?: string;
    },
    userId?: string,
  ) => {
    const { skip, take } = paginate(query);
    const where = {
      ...(userId !== undefined && { userId }),
      ...(query.status && { status: query.status as OrderStatus }),
      ...(query.customer &&
        userId === undefined && {
          user: {
            email: { contains: query.customer, mode: "insensitive" as const },
          },
        }),
    };
    return Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
    ]);
  },

  findById: (id: string) =>
    prisma.order.findUnique({ where: { id }, include: orderInclude }),

  create: (
    userId: string,
    data: CreateOrderDto,
    totalAmount: number,
    items: {
      productId: string;
      productName: string;
      productSku: string;
      combinationId?: string | null;
      combinationSnapshot?: Record<string, string> | null;
      quantity: number;
      price: number;
      originalPrice: number;
      discountAmount: number;
      discountSnapshot?: Record<string, unknown> | null;
    }[],
    couponCodeId?: string,
    discountedAmount?: number,
    shippingCost = 0,
    shippingMethodSnapshot?: Record<string, unknown> | null,
    couponSnapshot?: Record<string, unknown> | null,
  ) =>
    prisma.order.create({
      data: {
        userId,
        shippingAddressId: data.shippingAddressId ?? null,
        shippingAddressSnapshot: data.shippingAddress as object,
        billingAddressId: data.billingAddressId ?? null,
        billingAddressSnapshot: (data.billingAddress as object) ?? null,
        shippingMethodId: data.shippingMethodId ?? null,
        shippingCost,
        ...(shippingMethodSnapshot && {
          shippingMethodSnapshot: shippingMethodSnapshot as object,
        }),
        paymentMethodId: data.paymentMethodId,
        notes: data.notes,
        ...(couponCodeId && { couponCodeId }),
        ...(couponSnapshot && { couponSnapshot: couponSnapshot as object }),
        totalAmount,
        ...(discountedAmount !== undefined && { discountedAmount }),
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            productSku: i.productSku,
            combinationId: i.combinationId,
            combinationSnapshot: i.combinationSnapshot as object,
            quantity: i.quantity,
            price: i.price,
            originalPrice: i.originalPrice,
            discountAmount: i.discountAmount,
            ...(i.discountSnapshot && {
              discountSnapshot: i.discountSnapshot as object,
            }),
          })),
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: OrderStatus.PENDING,
            reason: "Order created",
          },
        },
      },
      include: orderInclude,
    }),

  findByUser: (userId: string, query: { page?: string; limit?: string }) => {
    const { skip, take } = paginate(query);
    return Promise.all([
      prisma.order.findMany({
        where: { userId },
        skip,
        take,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where: { userId } }),
    ]);
  },

  findStalePending: (olderThan: Date) =>
    prisma.order.findMany({
      where: { status: OrderStatus.PENDING, createdAt: { lt: olderThan } },
      select: { id: true },
    }),

  update: (
    id: string,
    data: UpdateOrderDto,
    recalculatedShipping?: {
      shippingCost: number;
      shippingMethodSnapshot: Record<string, unknown> | null;
      totalAmount: number;
    },
  ) =>
    prisma.order.update({
      where: { id },
      data: {
        ...(data.shippingAddressId && {
          shippingAddressId: data.shippingAddressId,
        }),
        ...(data.shippingAddress && {
          shippingAddressSnapshot: data.shippingAddress as object,
        }),
        ...(data.billingAddressId && {
          billingAddressId: data.billingAddressId,
        }),
        ...(data.billingAddress && {
          billingAddressSnapshot: data.billingAddress as object,
        }),
        ...(data.shippingMethodId && {
          shippingMethodId: data.shippingMethodId,
        }),
        ...(data.notes && { notes: data.notes }),
        ...(recalculatedShipping && {
          shippingCost: recalculatedShipping.shippingCost,
          shippingMethodSnapshot:
            recalculatedShipping.shippingMethodSnapshot as object,
          totalAmount: recalculatedShipping.totalAmount,
        }),
      },
      include: orderInclude,
    }),

  updateStatus: (
    id: string,
    status: OrderStatus,
    changedBy: string | null,
    reason?: string,
  ) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) throw new AppError("Order not found", 404);

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: current.status,
          toStatus: status,
          changedBy,
          reason,
        },
      });

      return tx.order.update({
        where: { id },
        data: { status },
        include: orderInclude,
      });
    }),

  delete: (id: string) => prisma.order.delete({ where: { id } }),
};

export const orderReservationRepository = {
  create: (orderItemId: string, warehouseId: string, quantity: number) =>
    prisma.orderItemReservation.create({
      data: { orderItemId, warehouseId, quantity },
    }),

  findByOrder: (orderId: string) =>
    prisma.orderItemReservation.findMany({
      where: { orderItem: { orderId } },
      include: {
        orderItem: { select: { productId: true, combinationId: true } },
      },
    }),

  findByOrderItem: (orderItemId: string) =>
    prisma.orderItemReservation.findMany({
      where: { orderItemId },
      include: {
        orderItem: { select: { productId: true, combinationId: true } },
      },
    }),

  deleteByOrder: (orderId: string) =>
    prisma.orderItemReservation.deleteMany({
      where: { orderItem: { orderId } },
    }),
};
