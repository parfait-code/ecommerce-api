import { prisma } from "../../shared/config/database";
import { CreateOrderDto, UpdateOrderDto } from "./order.schema";
import { OrderStatus } from "@prisma/client";
import { paginate } from "../../shared/utils/pagination";

const orderInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
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
  statusHistory: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
};

export const orderRepository = {
  findAll: (query: {
    status?: string;
    customer?: string;
    page?: string;
    limit?: string;
  }) => {
    const { skip, take } = paginate(query);
    const where = {
      ...(query.status && { status: query.status as OrderStatus }),
      ...(query.customer && { user: { email: query.customer } }),
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
      quantity: number;
      price: number;
      originalPrice: number;
      discountAmount: number;
    }[],
    couponCodeId?: string,
  ) =>
    prisma.order.create({
      data: {
        userId,
        shippingAddressId: data.shippingAddressId ?? null,
        shippingAddressSnapshot: data.shippingAddress as object,
        billingAddressId: data.billingAddressId ?? null,
        billingAddressSnapshot: (data.billingAddress as object) ?? null,
        paymentMethodId: data.paymentMethodId,
        notes: data.notes,
        ...(couponCodeId && { couponCodeId }),
        totalAmount,
        items: { create: items },
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
