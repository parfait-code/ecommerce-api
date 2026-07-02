import { basketRepository } from "./basket.repository";
import { productRepository } from "../products/product.repository";
import { variantRepository } from "../variants/variant.repository";
import {
  AddProductDto,
  UpdateQuantityDto,
  RemoveProductDto,
} from "./basket.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";

export const basketService = {
  // Idempotent : un seul panier par utilisateur, créé au premier appel
  getOrCreateForUser: async (userId: number) => {
    const existing = await basketRepository.findByUserId(userId);
    if (existing) return existing;
    return basketRepository.create(userId);
  },

  // Conservé pour compat avec l'ancienne route POST /basket — désormais idempotent
  create: (userId: number) => basketService.getOrCreateForUser(userId),

  getById: async (basketId: string) => {
    const basket = await basketRepository.findById(basketId);
    if (!basket) throw new AppError("Basket not found", 404);
    return basket;
  },

  addProduct: async (basketId: string, dto: AddProductDto) => {
    const basket = await basketRepository.findById(basketId);
    if (!basket) throw new AppError("Basket not found", 404);

    const product = await productRepository.findById(dto.product_id);
    if (!product) throw new AppError("Product not found", 404);

    if (dto.variant_id) {
      const variant = await variantRepository.findById(dto.variant_id);
      if (!variant || variant.productId !== dto.product_id)
        throw new AppError("Variant not found on this product", 404);
      if (!variant.isActive)
        throw new AppError("Variant is not available", 400);
    }

    await basketRepository.addItem(
      basketId,
      dto.product_id,
      dto.quantity,
      dto.variant_id,
    );

    businessLogger.log("ITEM_ADDED", {
      service: "basket",
      actor: { userId: basket.userId, role: "CUSTOMER" },
      target: { basketId, productId: dto.product_id },
      metadata: { quantity: dto.quantity, variantId: dto.variant_id ?? null },
    });

    return basketRepository.findById(basketId);
  },

  updateQuantity: async (basketId: string, dto: UpdateQuantityDto) => {
    const basket = await basketRepository.findById(basketId);
    if (!basket) throw new AppError("Basket not found", 404);

    const item = basket.items.find(
      (i) =>
        i.productId === dto.product_id &&
        i.variantId === (dto.variant_id ?? null),
    );
    if (!item) throw new AppError("Product not in basket", 404);

    await basketRepository.updateQuantity(
      basketId,
      dto.product_id,
      dto.quantity,
      dto.variant_id,
    );
    return basketRepository.findById(basketId);
  },

  removeProduct: async (basketId: string, dto: RemoveProductDto) => {
    const basket = await basketRepository.findById(basketId);
    if (!basket) throw new AppError("Basket not found", 404);

    const item = basket.items.find(
      (i) =>
        i.productId === dto.product_id &&
        i.variantId === (dto.variant_id ?? null),
    );
    if (!item) throw new AppError("Product not in basket", 404);

    await basketRepository.removeItem(basketId, dto.product_id, dto.variant_id);

    businessLogger.log("ITEM_REMOVED", {
      service: "basket",
      actor: { userId: basket.userId, role: "CUSTOMER" },
      target: { basketId, productId: dto.product_id },
      metadata: { variantId: dto.variant_id ?? null },
    });

    return basketRepository.findById(basketId);
  },
};
