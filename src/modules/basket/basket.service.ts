import { basketRepository } from "./basket.repository";
import { productRepository } from "../products/product.repository";
import { combinationRepository } from "../combinations/combination.repository";
import {
  AddProductDto,
  UpdateQuantityDto,
  RemoveProductDto,
} from "./basket.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";

export const basketService = {
  getOrCreateForUser: async (userId: number) => {
    const existing = await basketRepository.findByUserId(userId);
    if (existing) return existing;
    return basketRepository.create(userId);
  },

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

    if (dto.combination_id) {
      const combination = await combinationRepository.findById(
        dto.combination_id,
      );
      if (!combination || combination.productId !== dto.product_id)
        throw new AppError("Combination not found on this product", 404);
      if (!combination.isActive)
        throw new AppError("This combination is not available", 400);
    }

    await basketRepository.addItem(
      basketId,
      dto.product_id,
      dto.quantity,
      dto.combination_id,
    );

    businessLogger.log("ITEM_ADDED", {
      service: "basket",
      actor: { userId: basket.userId, role: "CUSTOMER" },
      target: { basketId, productId: dto.product_id },
      metadata: {
        quantity: dto.quantity,
        combinationId: dto.combination_id ?? null,
      },
    });

    return basketRepository.findById(basketId);
  },

  updateQuantity: async (basketId: string, dto: UpdateQuantityDto) => {
    const basket = await basketRepository.findById(basketId);
    if (!basket) throw new AppError("Basket not found", 404);

    const item = basket.items.find(
      (i) =>
        i.productId === dto.product_id &&
        i.combinationId === (dto.combination_id ?? null),
    );
    if (!item) throw new AppError("Product not in basket", 404);

    await basketRepository.updateQuantity(
      basketId,
      dto.product_id,
      dto.quantity,
      dto.combination_id,
    );
    return basketRepository.findById(basketId);
  },

  removeProduct: async (basketId: string, dto: RemoveProductDto) => {
    const basket = await basketRepository.findById(basketId);
    if (!basket) throw new AppError("Basket not found", 404);

    const item = basket.items.find(
      (i) =>
        i.productId === dto.product_id &&
        i.combinationId === (dto.combination_id ?? null),
    );
    if (!item) throw new AppError("Product not in basket", 404);

    await basketRepository.removeItem(
      basketId,
      dto.product_id,
      dto.combination_id,
    );

    businessLogger.log("ITEM_REMOVED", {
      service: "basket",
      actor: { userId: basket.userId, role: "CUSTOMER" },
      target: { basketId, productId: dto.product_id },
      metadata: { combinationId: dto.combination_id ?? null },
    });

    return basketRepository.findById(basketId);
  },
};
