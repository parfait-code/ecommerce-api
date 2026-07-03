import { prisma } from "../../shared/config/database";
import { CreateOrderDto, UpdateOrderDto } from "./order.schema";
import { OrderStatus } from "@prisma/client";
import { paginate } from "../../shared/utils/pagination";

const orderInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
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
    userId?: number,
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
    userId: number,
    data: CreateOrderDto,
    totalAmount: number,
    items: {
      productId: number;
      combinationId?: string | null;
      combinationSnapshot?: Record<string, string> | null;
      quantity: number;
      price: number;
      originalPrice: number;
      discountAmount: number;
    }[],
    couponCodeId?: string,
    discountedAmount?: number,
  ) =>
    prisma.order.create({
      data: {
        userId,
        shippingAddressId: data.shippingAddressId ?? null,
        shippingAddressSnapshot: data.shippingAddress as object,
        billingAddressId: data.billingAddressId ?? null,
        billingAddressSnapshot: (data.billingAddress as object) ?? null,
        shippingMethodId: data.shippingMethodId ?? null,
        paymentMethodId: data.paymentMethodId,
        notes: data.notes,
        ...(couponCodeId && { couponCodeId }),
        totalAmount,
        ...(discountedAmount !== undefined && { discountedAmount }),
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            combinationId: i.combinationId,
            combinationSnapshot: i.combinationSnapshot as object,
            quantity: i.quantity,
            price: i.price,
            originalPrice: i.originalPrice,
            discountAmount: i.discountAmount,
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

  findByUser: (userId: number, query: { page?: string; limit?: string }) => {
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

  update: (id: string, data: UpdateOrderDto) =>
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
      },
      include: orderInclude,
    }),

  updateStatus: (
    id: string,
    status: OrderStatus,
    changedBy: number | null,
    reason?: string,
  ) =>
    prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) throw new Error("Order not found");

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

// ── Traçabilité des réservations de stock (pour libération précise à l'annulation) ──
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

  deleteByOrder: (orderId: string) =>
    prisma.orderItemReservation.deleteMany({
      where: { orderItem: { orderId } },
    }),
};
