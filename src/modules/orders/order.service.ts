import {
  orderRepository,
  orderReservationRepository,
} from "./order.repository";
import { productRepository } from "../products/product.repository";
import { combinationRepository } from "../combinations/combination.repository";
import { basketRepository } from "../basket/basket.repository";
import { inventoryRepository } from "../inventory/inventory.repository";
import { loyaltyService } from "../loyalty/loyalty.service";
import { promotionRepository } from "../promotions/promotion.repository";
import { shippingMethodRepository } from "../shipping-methods/shipping-method.repository";
import { getBestPricing } from "../promotions/promotion.pricing";
import { assertValidTransition } from "./order.state-machine";
import {
  CreateOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
} from "./order.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";
import { eventBus } from "../../shared/events/event-bus";
import { businessLogger, auditLogger, ActorRole } from "../../shared/logger";
import { OrderStatus } from "@prisma/client";

const CACHE_KEYS = {
  all: (query: Record<string, string>) => `orders:all:${JSON.stringify(query)}`,
  single: (id: string) => `orders:${id}`,
};

const resolveCoupon = async (
  code: string,
  userId: number,
  orderTotal: number,
) => {
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
  if (coupon.minOrderAmount !== null && orderTotal < coupon.minOrderAmount)
    throw new AppError(
      `This coupon requires a minimum order amount of ${coupon.minOrderAmount}`,
      400,
    );

  const userUseCount = coupon.uses.filter((u) => u.userId === userId).length;
  if (userUseCount >= coupon.perUserLimit)
    throw new AppError(
      "You have already used this coupon the maximum number of times",
      400,
    );

  return coupon;
};

const releaseReservedStock = async (orderId: string) => {
  const reservations = await orderReservationRepository.findByOrder(orderId);

  for (const r of reservations) {
    const invRow = await inventoryRepository.findByProductAndWarehouse(
      r.orderItem.productId,
      r.warehouseId,
      r.orderItem.combinationId ?? undefined,
    );

    if (invRow) {
      await inventoryRepository.incrementQuantity(invRow.id, r.quantity);
    } else {
      await inventoryRepository.create({
        product_id: r.orderItem.productId,
        warehouse_id: r.warehouseId,
        combination_id: r.orderItem.combinationId ?? undefined,
        quantity: r.quantity,
      });
    }
  }

  await orderReservationRepository.deleteByOrder(orderId);
};

export const orderService = {
  getAll: async (
    query: {
      status?: string;
      customer?: string;
      page?: string;
      limit?: string;
    },
    userId: number,
    isAdmin: boolean,
  ) => {
    const cacheKey = CACHE_KEYS.all({
      ...query,
      scope: isAdmin ? "all" : String(userId),
    } as Record<string, string>);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const [items, total] = await orderRepository.findAll(
      query,
      isAdmin ? undefined : userId,
    );
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
    // Corrigé — le calculateur (/shipments/cost) vérifiait déjà isActive,
    // mais rien n'empêchait de construire directement la requête de commande
    // avec un shippingMethodId désactivé. Contrôle déplacé ici, avant toute
    // écriture, pour couvrir le chemin réel de création de commande.
    if (dto.shippingMethodId) {
      const shippingMethod = await shippingMethodRepository.findById(
        dto.shippingMethodId,
      );
      if (!shippingMethod) throw new AppError("Shipping method not found", 404);
      if (!shippingMethod.isActive)
        throw new AppError("This shipping method is not available", 400);
    }

    const activeDiscounts = await promotionRepository.findActiveDiscounts();

    let sourceItems: { id: string; combinationId?: string; quantity: number }[];
    let basketToClear: string | undefined;

    if (dto.items && dto.items.length > 0) {
      sourceItems = dto.items;
    } else {
      if (!dto.basketId)
        throw new AppError("Either items or basketId must be provided", 400);

      const basket = await basketRepository.findById(dto.basketId);
      if (!basket) throw new AppError("Basket not found", 404);
      if (basket.userId !== userId) throw new AppError("Forbidden", 403);
      if (basket.items.length === 0) throw new AppError("Basket is empty", 400);

      sourceItems = basket.items.map((i) => ({
        id: String(i.productId),
        combinationId: i.combinationId ?? undefined,
        quantity: i.quantity,
      }));
      basketToClear = basket.id;
    }

    const orderItems: {
      productId: number;
      productName: string;
      productSku: string;
      combinationId?: string | null;
      combinationSnapshot?: Record<string, string> | null;
      quantity: number;
      price: number;
      originalPrice: number;
      discountAmount: number;
    }[] = [];

    let totalAmount = 0;
    let totalOriginalAmount = 0;

    for (const item of sourceItems) {
      const product = await productRepository.findById(Number(item.id));
      if (!product) throw new AppError(`Product ${item.id} not found`, 404);

      if (!item.combinationId && product.combinations.length > 0)
        throw new AppError(
          `Product "${product.name}" requires selecting a combination`,
          400,
        );

      let unitPrice = product.price;
      let combinationSnapshot: Record<string, string> | null = null;

      if (item.combinationId) {
        const combination = await combinationRepository.findById(
          item.combinationId,
        );
        if (!combination || combination.productId !== product.id)
          throw new AppError(
            `Combination ${item.combinationId} not found on product ${item.id}`,
            404,
          );
        if (!combination.isActive)
          throw new AppError(
            `Combination ${item.combinationId} is not available`,
            400,
          );
        if (combination.price !== null) unitPrice = combination.price;

        combinationSnapshot = {};
        for (const v of combination.values) {
          combinationSnapshot[v.attributeDefinition.name] =
            v.attributeOption.value;
        }
      }

      const available = await inventoryRepository.sumAvailable(
        product.id,
        item.combinationId ?? null,
      );
      if (available < item.quantity)
        throw new AppError(
          `Insufficient stock for product "${product.name}": ${available} available, ${item.quantity} requested`,
          400,
        );

      const pricing = getBestPricing(
        { ...product, price: unitPrice },
        activeDiscounts as any,
      );

      orderItems.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        combinationId: item.combinationId ?? null,
        combinationSnapshot,
        quantity: item.quantity,
        price: pricing.finalPrice,
        originalPrice: unitPrice,
        discountAmount:
          Math.round(pricing.discountAmount * item.quantity * 100) / 100,
      });

      totalAmount += pricing.finalPrice * item.quantity;
      totalOriginalAmount += unitPrice * item.quantity;
    }

    totalAmount = Math.round(totalAmount * 100) / 100;
    totalOriginalAmount = Math.round(totalOriginalAmount * 100) / 100;

    const coupon = dto.couponCode
      ? await resolveCoupon(dto.couponCode, userId, totalAmount)
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

    try {
      for (const orderItem of order.items) {
        const rows = await inventoryRepository.findAvailableOrdered(
          orderItem.productId,
          orderItem.combinationId ?? null,
        );
        let remaining = orderItem.quantity;

        for (const row of rows) {
          if (remaining <= 0) break;
          const take = Math.min(row.quantity, remaining);
          await inventoryRepository.decrementQuantity(row.id, take);
          await orderReservationRepository.create(
            orderItem.id,
            row.warehouseId,
            take,
          );
          remaining -= take;
        }

        if (remaining > 0) {
          throw new AppError(
            `Stock became unavailable while placing the order for product ${orderItem.productId}`,
            409,
          );
        }
      }
    } catch (err) {
      await releaseReservedStock(order.id);
      await orderRepository.delete(order.id);
      throw err;
    }

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

    if (basketToClear) await basketRepository.clearItems(basketToClear);

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
    actorRole: ActorRole = "ADMIN",
  ) => {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError("Order not found", 404);

    assertValidTransition(order.status, dto.status);

    const oldStatus = order.status;
    const updated = await orderRepository.updateStatus(
      id,
      dto.status,
      changedBy,
      dto.reason,
    );

    if (
      dto.status === OrderStatus.CANCELLED &&
      oldStatus !== OrderStatus.CANCELLED
    ) {
      await releaseReservedStock(id);
    }

    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("orders:all:*");

    businessLogger.log("ORDER_STATUS_CHANGED", {
      service: "orders",
      actor: { userId: changedBy, role: actorRole },
      target: { orderId: id },
      metadata: { oldStatus, newStatus: dto.status },
    });

    auditLogger.log("ORDER_STATUS_CHANGED", {
      service: "orders",
      actor: { userId: changedBy, role: actorRole },
      target: { orderId: id },
      metadata: { oldStatus, newStatus: dto.status },
    });

    if (
      dto.status === OrderStatus.DELIVERED &&
      oldStatus !== OrderStatus.DELIVERED
    ) {
      await loyaltyService.earnFromOrder(order.userId, id, order.totalAmount);
    }

    eventBus.emit("order.status.changed", {
      orderId: id,
      userId: order.userId,
      fromStatus: oldStatus,
      toStatus: dto.status,
      totalAmount: order.totalAmount,
    });

    return updated;
  },

  delete: async (id: string, userId: number, isAdmin: boolean) => {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError("Order not found", 404);
    if (!isAdmin && order.userId !== userId)
      throw new AppError("Forbidden", 403);

    assertValidTransition(order.status, OrderStatus.CANCELLED);

    await orderRepository.updateStatus(
      id,
      OrderStatus.CANCELLED,
      userId,
      isAdmin ? "Cancelled by admin" : "Cancelled by customer",
    );
    await releaseReservedStock(id);

    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("orders:all:*");

    businessLogger.log("ORDER_CANCELLED", {
      service: "orders",
      actor: { userId, role: isAdmin ? "ADMIN" : "CUSTOMER" },
      target: { orderId: id },
      metadata: { totalAmount: order.totalAmount },
    });

    auditLogger.log("ORDER_CANCELLED", {
      service: "orders",
      actor: { userId, role: isAdmin ? "ADMIN" : "CUSTOMER" },
      target: { orderId: id },
      metadata: { totalAmount: order.totalAmount },
    });

    eventBus.emit("order.status.changed", {
      orderId: id,
      userId: order.userId,
      fromStatus: order.status,
      toStatus: OrderStatus.CANCELLED,
      totalAmount: order.totalAmount,
    });

    return { message: "Order cancelled successfully" };
  },
};
