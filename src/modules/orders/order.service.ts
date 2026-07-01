import { orderRepository } from "./order.repository";
import { productRepository } from "../products/product.repository";
import { loyaltyService } from "../loyalty/loyalty.service";
import { promotionRepository } from "../promotions/promotion.repository";
import { getBestPricing } from "../promotions/promotion.pricing";
import {
  CreateOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
} from "./order.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";
import { businessLogger, auditLogger } from "../../shared/logger";
import { OrderStatus } from "@prisma/client";

const CACHE_KEYS = {
  all: (query: Record<string, string>) => `orders:all:${JSON.stringify(query)}`,
  single: (id: string) => `orders:${id}`,
};

const resolveCoupon = async (code: string, userId: number) => {
  const coupon = await promotionRepository.findCouponByCode(code);
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
    throw new AppError("This coupon has reached its maximum usage limit", 400);

  const userUseCount = coupon.uses.filter((u) => u.userId === userId).length;
  if (userUseCount >= coupon.perUserLimit)
    throw new AppError(
      "You have already used this coupon the maximum number of times",
      400,
    );

  return coupon;
};

export const orderService = {
  getAll: async (query: {
    status?: string;
    customer?: string;
    page?: string;
    limit?: string;
  }) => {
    const cacheKey = CACHE_KEYS.all(query as Record<string, string>);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const [items, total] = await orderRepository.findAll(query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const result = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await cache.set(cacheKey, result);
    return result;
  },

  getById: async (id: string, userId: number, isAdmin: boolean) => {
    const cacheKey = CACHE_KEYS.single(id);
    const cached = await cache.get<{ userId: number }>(cacheKey);
    if (cached) {
      if (!isAdmin && cached.userId !== userId)
        throw new AppError("Forbidden", 403);
      return cached;
    }

    const order = await orderRepository.findById(id);
    if (!order) throw new AppError("Order not found", 404);
    if (!isAdmin && order.userId !== userId)
      throw new AppError("Forbidden", 403);

    await cache.set(cacheKey, order);
    return order;
  },

  create: async (userId: number, dto: CreateOrderDto) => {
    const activeDiscounts = await promotionRepository.findActiveDiscounts();

    const orderItems: {
      productId: number;
      quantity: number;
      price: number;
      originalPrice: number;
      discountAmount: number;
    }[] = [];

    let totalAmount = 0;
    let totalOriginalAmount = 0;

    for (const item of dto.items) {
      const product = await productRepository.findById(Number(item.id));
      if (!product) throw new AppError(`Product ${item.id} not found`, 404);

      const pricing = getBestPricing(product, activeDiscounts as any);

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: pricing.finalPrice,
        originalPrice: product.price,
        discountAmount:
          Math.round(pricing.discountAmount * item.quantity * 100) / 100,
      });

      totalAmount += pricing.finalPrice * item.quantity;
      totalOriginalAmount += product.price * item.quantity;
    }

    totalAmount = Math.round(totalAmount * 100) / 100;
    totalOriginalAmount = Math.round(totalOriginalAmount * 100) / 100;

    const coupon = dto.couponCode
      ? await resolveCoupon(dto.couponCode, userId)
      : null;

    const discountedAmount =
      totalOriginalAmount > totalAmount
        ? Math.round((totalOriginalAmount - totalAmount) * 100) / 100
        : undefined;

    const order = await orderRepository.create(
      userId,
      dto,
      totalAmount,
      orderItems,
      coupon?.id,
      discountedAmount,
    );

    if (coupon) {
      await promotionRepository.incrementCouponUsage(coupon.id);
      await promotionRepository.createCouponUse(coupon.id, userId, order.id);

      businessLogger.log("COUPON_APPLIED", {
        service: "orders",
        actor: { userId, role: "CUSTOMER" },
        target: { orderId: order.id, couponId: coupon.id },
        metadata: { code: coupon.code },
      });
    }

    await cache.delByPattern("orders:all:*");

    businessLogger.log("ORDER_CREATED", {
      service: "orders",
      actor: { userId, role: "CUSTOMER" },
      target: { orderId: order.id },
      metadata: { totalAmount, itemCount: orderItems.length },
    });

    return order;
  },

  update: async (
    id: string,
    dto: UpdateOrderDto,
    userId: number,
    isAdmin: boolean,
  ) => {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError("Order not found", 404);
    if (!isAdmin && order.userId !== userId)
      throw new AppError("Forbidden", 403);

    const updated = await orderRepository.update(id, dto);
    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("orders:all:*");
    return updated;
  },

  getByUser: async (
    userId: number,
    query: { page?: string; limit?: string },
  ) => {
    const [items, total] = await orderRepository.findByUser(userId, query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  updateStatus: async (
    id: string,
    dto: UpdateOrderStatusDto,
    changedBy: number | null,
  ) => {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError("Order not found", 404);

    const oldStatus = order.status;
    const updated = await orderRepository.updateStatus(
      id,
      dto.status,
      changedBy,
      dto.reason,
    );

    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("orders:all:*");

    businessLogger.log("ORDER_STATUS_CHANGED", {
      service: "orders",
      actor: { userId: order.userId, role: "ADMIN" },
      target: { orderId: id },
      metadata: { oldStatus, newStatus: dto.status },
    });

    auditLogger.log("ORDER_STATUS_CHANGED", {
      service: "orders",
      actor: { userId: order.userId, role: "ADMIN" },
      target: { orderId: id },
      metadata: { oldStatus, newStatus: dto.status },
    });

    if (
      dto.status === OrderStatus.DELIVERED &&
      oldStatus !== OrderStatus.DELIVERED
    ) {
      await loyaltyService.earnFromOrder(order.userId, id, order.totalAmount);
    }

    return updated;
  },

  delete: async (id: string, userId: number, isAdmin: boolean) => {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError("Order not found", 404);
    if (!isAdmin && order.userId !== userId)
      throw new AppError("Forbidden", 403);

    await orderRepository.delete(id);
    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("orders:all:*");

    businessLogger.log("ORDER_CANCELLED", {
      service: "orders",
      actor: { userId: order.userId, role: "CUSTOMER" },
      target: { orderId: id },
      metadata: { totalAmount: order.totalAmount },
    });

    auditLogger.log("ORDER_CANCELLED", {
      service: "orders",
      actor: { userId: order.userId, role: "CUSTOMER" },
      target: { orderId: id },
      metadata: { totalAmount: order.totalAmount },
    });

    return { message: "Order cancelled successfully" };
  },
};
