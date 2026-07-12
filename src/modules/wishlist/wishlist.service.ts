import { productRepository } from "../products/product.repository";
import { wishlistRepository } from "../wishlist/wishlist.repository";
import { combinationRepository } from "../combinations/combination.repository";
import { AddWishlistItemDto, RemoveWishlistItemDto } from "./wishlist.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";

const getOrCreate = async (userId: string) => {
  const existing = await wishlistRepository.findByUserId(userId);
  if (existing) return existing;
  return wishlistRepository.create(userId);
};

export const wishlistService = {
  getByUser: (userId: string) => getOrCreate(userId),

  addItem: async (userId: string, dto: AddWishlistItemDto) => {
    const product = await productRepository.findById(dto.product_id);
    if (!product) throw new AppError("Product not found", 404);

    if (dto.combination_id) {
      const combination = await combinationRepository.findById(
        dto.combination_id,
      );
      if (!combination || combination.productId !== dto.product_id)
        throw new AppError("Combination not found on this product", 404);
    }

    const wishlist = await getOrCreate(userId);
    await wishlistRepository.addItem(
      wishlist.id,
      dto.product_id,
      dto.combination_id,
    );

    businessLogger.log("WISHLIST_ITEM_ADDED", {
      service: "wishlist",
      actor: { userId, role: "CUSTOMER" },
      target: { productId: dto.product_id },
      metadata: { combinationId: dto.combination_id ?? null },
    });

    return wishlistRepository.findByUserId(userId);
  },

  removeItem: async (userId: string, dto: RemoveWishlistItemDto) => {
    const wishlist = await getOrCreate(userId);

    const item = wishlist.items.find(
      (i) =>
        i.productId === dto.product_id &&
        i.combinationId === (dto.combination_id ?? null),
    );
    if (!item) throw new AppError("Product not in wishlist", 404);

    await wishlistRepository.removeItem(
      wishlist.id,
      dto.product_id,
      dto.combination_id,
    );

    businessLogger.log("WISHLIST_ITEM_REMOVED", {
      service: "wishlist",
      actor: { userId, role: "CUSTOMER" },
      target: { productId: dto.product_id },
      metadata: { combinationId: dto.combination_id ?? null },
    });

    return wishlistRepository.findByUserId(userId);
  },
};
