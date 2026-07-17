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
import { settingService } from "../settings/setting.service";
import { SETTING_KEYS } from "../settings/setting.constants";
import { assertValidTransition } from "./order.state-machine";
import { normalizeCountry } from "../../shared/constants/countries";
import {
  CreateOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
} from "./order.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";
import { eventBus } from "../../shared/events/event-bus";
import {
  businessLogger,
  auditLogger,
  ActorRole,
  systemLogger,
} from "../../shared/logger";
import { OrderStatus } from "@prisma/client";

const CACHE_KEYS = {
  all: (query: Record<string, string>) => `orders:all:${JSON.stringify(query)}`,
  single: (id: string) => `orders:${id}`,
};

const resolveCoupon = async (
  code: string,
  userId: string,
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
    if (r.orderItem.productId === null) continue;

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

// Formule identique à shippingMethodService.calculate() — seule source de
// vérité pour le coût de livraison. Le client ne fournit JAMAIS ce montant :
// il est toujours recalculé ici, à partir du poids réel des articles commandés.
const computeShippingCost = (
  shippingMethod: { basePrice: number; pricePerKg: number },
  totalWeight: number,
) =>
  Math.round(
    (shippingMethod.basePrice + shippingMethod.pricePerKg * totalWeight) * 100,
  ) / 100;

export const orderService = {
  getAll: async (
    query: {
      status?: string;
      customer?: string;
      page?: string;
      limit?: string;
    },
    userId: string,
    isAdmin: boolean,
  ) => {
    const cacheKey = CACHE_KEYS.all({
      ...query,
      scope: isAdmin ? "all" : userId,
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

  getById: async (id: string, userId: string, isAdmin: boolean) => {
    const cacheKey = CACHE_KEYS.single(id);
    const cached = await cache.get<{ userId: string }>(cacheKey);
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

  create: async (userId: string, dto: CreateOrderDto) => {
    const normalizedShippingCountry = normalizeCountry(
      dto.shippingAddress.country,
    );
    if (!normalizedShippingCountry)
      throw new AppError(
        `"${dto.shippingAddress.country}" is not a supported country`,
        400,
      );

    let normalizedBillingCountry: string | undefined;
    if (dto.billingAddress) {
      normalizedBillingCountry =
        normalizeCountry(dto.billingAddress.country) ?? undefined;
      if (!normalizedBillingCountry)
        throw new AppError(
          `"${dto.billingAddress.country}" is not a supported country`,
          400,
        );
    }

    dto = {
      ...dto,
      shippingAddress: {
        ...dto.shippingAddress,
        country: normalizedShippingCountry,
      },
      ...(dto.billingAddress && {
        billingAddress: {
          ...dto.billingAddress,
          country: normalizedBillingCountry!,
        },
      }),
    };

    // Récupéré ici (hors du if) pour être réutilisé plus bas dans le calcul
    // du coût de livraison — évite un second appel réseau à la DB.
    let shippingMethod: Awaited<
      ReturnType<typeof shippingMethodRepository.findById>
    > | null = null;

    if (dto.shippingMethodId) {
      shippingMethod = await shippingMethodRepository.findById(
        dto.shippingMethodId,
      );
      if (!shippingMethod) throw new AppError("Shipping method not found", 404);
      if (!shippingMethod.isActive)
        throw new AppError("This shipping method is not available", 400);

      if (!shippingMethod.zones.includes(normalizedShippingCountry))
        throw new AppError(
          `Shipping method "${shippingMethod.name}" does not deliver to ${normalizedShippingCountry}`,
          400,
        );
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
        id: i.productId,
        combinationId: i.combinationId ?? undefined,
        quantity: i.quantity,
      }));
      basketToClear = basket.id;
    }

    const orderItems: {
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
    }[] = [];

    let totalAmount = 0;
    let totalOriginalAmount = 0;
    let totalWeight = 0;

    for (const item of sourceItems) {
      const product = await productRepository.findById(item.id);
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
        // Copie figée du "pourquoi" de la remise — survit à la suppression
        // ou modification ultérieure de la Promotion/du Discount concerné.
        discountSnapshot: pricing.hasDiscount
          ? {
              promotionId: pricing.promotionId,
              promotionName: pricing.promotionName,
              discountId: pricing.discountId,
              type: pricing.discountType,
              value: pricing.discountValue,
              percentage: pricing.discountPercentage,
            }
          : null,
      });

      totalAmount += pricing.finalPrice * item.quantity;
      totalOriginalAmount += unitPrice * item.quantity;
      totalWeight += product.weight * item.quantity;
    }

    totalAmount = Math.round(totalAmount * 100) / 100;
    totalOriginalAmount = Math.round(totalOriginalAmount * 100) / 100;

    // Le montant minimum d'un coupon se vérifie sur le sous-total produit,
    // AVANT ajout des frais de port.
    const coupon = dto.couponCode
      ? await resolveCoupon(dto.couponCode, userId, totalAmount)
      : null;

    const discountedAmount =
      totalOriginalAmount > totalAmount
        ? Math.round((totalOriginalAmount - totalAmount) * 100) / 100
        : undefined;

    // Coût de livraison — calculé et figé côté serveur, JAMAIS fourni par
    // le client. Corrige le bug où les frais de port n'étaient jamais
    // inclus dans le montant payé.
    let shippingCost = 0;
    let shippingMethodSnapshot: Record<string, unknown> | null = null;
    if (shippingMethod) {
      shippingCost = computeShippingCost(shippingMethod, totalWeight);
      shippingMethodSnapshot = {
        id: shippingMethod.id,
        name: shippingMethod.name,
        estimatedDays: shippingMethod.estimatedDays,
        basePrice: shippingMethod.basePrice,
        pricePerKg: shippingMethod.pricePerKg,
        zones: shippingMethod.zones,
        weightUsed: totalWeight,
      };
    }

    const couponSnapshot = coupon
      ? {
          code: coupon.code,
          promotionId: coupon.promotion.id,
          promotionName: coupon.promotion.name,
          minOrderAmount: coupon.minOrderAmount,
          discounts: coupon.promotion.discounts.map((d) => ({
            id: d.id,
            type: d.type,
            value: d.value,
            categoryId: d.categoryId,
          })),
        }
      : null;

    // Montant réellement payable = sous-total produit (déjà remisé) + livraison.
    const payableAmount = Math.round((totalAmount + shippingCost) * 100) / 100;

    const order = await orderRepository.create(
      userId,
      dto,
      payableAmount,
      orderItems,
      coupon?.id,
      discountedAmount,
      shippingCost,
      shippingMethodSnapshot,
      couponSnapshot,
    );

    try {
      try {
        for (const orderItem of order.items) {
          if (orderItem.productId === null) {
            throw new AppError(
              `Order item ${orderItem.id} has no associated product`,
              500,
            );
          }

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
      metadata: {
        totalAmount: payableAmount,
        itemCount: orderItems.length,
        shippingCost,
      },
    });

    return order;
  },

  update: async (
    id: string,
    dto: UpdateOrderDto,
    userId: string,
    isAdmin: boolean,
  ) => {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError("Order not found", 404);
    if (!isAdmin && order.userId !== userId)
      throw new AppError("Forbidden", 403);

    if (dto.shippingAddress) {
      const normalized = normalizeCountry(dto.shippingAddress.country);
      if (!normalized)
        throw new AppError(
          `"${dto.shippingAddress.country}" is not a supported country`,
          400,
        );
      dto = {
        ...dto,
        shippingAddress: { ...dto.shippingAddress, country: normalized },
      };
    }

    if (dto.billingAddress) {
      const normalized = normalizeCountry(dto.billingAddress.country);
      if (!normalized)
        throw new AppError(
          `"${dto.billingAddress.country}" is not a supported country`,
          400,
        );
      dto = {
        ...dto,
        billingAddress: { ...dto.billingAddress, country: normalized },
      };
    }

    let recalculatedShipping:
      | {
          shippingCost: number;
          shippingMethodSnapshot: Record<string, unknown> | null;
          totalAmount: number;
        }
      | undefined;

    if (dto.shippingMethodId) {
      const shippingMethod = await shippingMethodRepository.findById(
        dto.shippingMethodId,
      );
      if (!shippingMethod) throw new AppError("Shipping method not found", 404);
      if (!shippingMethod.isActive)
        throw new AppError("This shipping method is not available", 400);

      const effectiveCountry =
        dto.shippingAddress?.country ??
        (order.shippingAddressSnapshot as { country?: string })?.country;

      if (
        effectiveCountry &&
        !shippingMethod.zones.includes(effectiveCountry)
      ) {
        throw new AppError(
          `Shipping method "${shippingMethod.name}" does not deliver to ${effectiveCountry}`,
          400,
        );
      }

      // La méthode de livraison change → recalculer le coût de port et le
      // total payable de la commande, sans jamais faire confiance à un
      // montant fourni par le client.
      if (dto.shippingMethodId !== order.shippingMethodId) {
        const totalWeight = order.items.reduce(
          (sum, item) => sum + (item.product?.weight ?? 0) * item.quantity,
          0,
        );
        const shippingCost = computeShippingCost(shippingMethod, totalWeight);

        recalculatedShipping = {
          shippingCost,
          shippingMethodSnapshot: {
            id: shippingMethod.id,
            name: shippingMethod.name,
            estimatedDays: shippingMethod.estimatedDays,
            basePrice: shippingMethod.basePrice,
            pricePerKg: shippingMethod.pricePerKg,
            zones: shippingMethod.zones,
            weightUsed: totalWeight,
          },
          totalAmount:
            Math.round(
              (order.totalAmount - order.shippingCost + shippingCost) * 100,
            ) / 100,
        };
      }
    }

    const updated = await orderRepository.update(id, dto, recalculatedShipping);
    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("orders:all:*");
    return updated;
  },

  getByUser: async (
    userId: string,
    query: { page?: string; limit?: string },
  ) => {
    const [items, total] = await orderRepository.findByUser(userId, query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  expireStalePending: async (hoursThreshold?: number): Promise<number> => {
    const effectiveHours =
      hoursThreshold ??
      (await settingService.getNumber(
        SETTING_KEYS.ORDERS_STALE_PENDING_HOURS,
        24,
      ));
    const threshold = new Date(Date.now() - effectiveHours * 60 * 60 * 1000);
    const stale = await orderRepository.findStalePending(threshold);

    for (const order of stale) {
      try {
        await orderService.updateStatus(
          order.id,
          {
            status: OrderStatus.CANCELLED,
            reason: `Automatically cancelled: no payment confirmation within ${hoursThreshold}h`,
          },
          null,
          "SYSTEM",
        );
      } catch (err) {
        systemLogger.error("ORDER_SYNC_FAILED", {
          service: "order-service",
          metadata: {
            orderId: order.id,
            reason: "Failed to auto-cancel stale pending order",
            error: (err as Error).message,
          },
        });
      }
    }

    return stale.length;
  },

  updateStatus: async (
    id: string,
    dto: UpdateOrderStatusDto,
    changedBy: string | null,
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

  delete: async (id: string, userId: string, isAdmin: boolean) => {
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
