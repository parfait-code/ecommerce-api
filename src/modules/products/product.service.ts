import { productRepository } from "./product.repository";
import { combinationRepository } from "../combinations/combination.repository";
import { attributeRepository } from "../attributes/attribute.repository";
import { promotionRepository } from "../promotions/promotion.repository";
import { getBestPricing } from "../promotions/promotion.pricing";
import { inventoryRepository } from "../inventory/inventory.repository";
import { CreateProductDto, UpdateProductDto } from "./product.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";
import { uploadImage, deleteImage } from "../../shared/utils/upload";
import { eventBus } from "../../shared/events/event-bus";
import { businessLogger, auditLogger } from "../../shared/logger";
import { ProductStatus } from "@prisma/client";

type ProductQuery = {
  page?: string;
  limit?: string;
  categoryId?: string;
  search?: string;
};

const CACHE_KEYS = {
  all: (page: number, limit: number, categoryId?: string, search?: string) =>
    `products:all:${page}:${limit}${categoryId ? `:${categoryId}` : ""}${search ? `:${search}` : ""}`,
  single: (id: number) => `products:${id}`,
};

/**
 * Un produit ne peut passer ACTIVE que si tous les attributs produit
 * (isVariant: false) marqués isRequired: true sur sa catégorie sont renseignés.
 * Les attributs de variante ne sont pas concernés par ce contrôle.
 */
const assertReadyForActivation = async (product: {
  categoryId: string;
  attributeValues: { attributeDefinitionId: string }[];
}) => {
  const required = await attributeRepository.findRequiredByCategory(
    product.categoryId,
  );
  if (required.length === 0) return;

  const setIds = new Set(
    product.attributeValues.map((v) => v.attributeDefinitionId),
  );
  const missing = required.filter((r) => !setIds.has(r.id));

  if (missing.length > 0) {
    throw new AppError(
      `Cannot activate product: missing required attributes (${missing
        .map((m) => m.name)
        .join(", ")})`,
      400,
    );
  }
};

export const productService = {
  getAll: async (query: ProductQuery, includeInactive = false) => {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const cacheKey = CACHE_KEYS.all(
      page,
      limit,
      query.categoryId,
      query.search,
    );

    if (!includeInactive) {
      const cached = await cache.get<{
        items: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(cacheKey);
      if (cached) return cached;
    }

    const [items, total] = await productRepository.findAll(
      query,
      includeInactive,
    );
    const activeDiscounts = await promotionRepository.findActiveDiscounts();

    const itemsWithPricing = items.map((item: any) => ({
      ...item,
      pricing: getBestPricing(item, activeDiscounts as any),
    }));

    const result = {
      items: itemsWithPricing,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    if (!includeInactive) await cache.set(cacheKey, result);
    return result;
  },

  getById: async (id: number, includeInactive = false) => {
    const cacheKey = CACHE_KEYS.single(id);
    if (!includeInactive) {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    }

    const product = await productRepository.findById(id, includeInactive);
    if (!product) throw new AppError("Product not found", 404);

    const activeDiscounts = await promotionRepository.findActiveDiscounts();
    const productWithPricing = {
      ...product,
      pricing: getBestPricing(product, activeDiscounts as any),
    };

    if (!includeInactive) await cache.set(cacheKey, productWithPricing);
    return productWithPricing;
  },

  create: async (dto: CreateProductDto) => {
    // Un produit naît toujours en DRAFT — il ne peut avoir d'attributs
    // renseignés avant d'exister, donc jamais ACTIVE à la création,
    // quelle que soit la valeur envoyée par le client.
    const product = await productRepository.create({
      ...dto,
      status: ProductStatus.DRAFT,
    });
    await cache.delByPattern("products:all:*");

    businessLogger.log("PRODUCT_CREATED", {
      service: "products",
      actor: { userId: null, role: "ADMIN" },
      target: { productId: product.id },
      metadata: {
        name: product.name,
        price: product.price,
        categoryId: dto.categoryId,
      },
    });

    auditLogger.log("PRODUCT_CREATED", {
      service: "products",
      actor: { userId: null, role: "ADMIN" },
      target: { productId: product.id },
      metadata: { name: product.name, price: product.price },
    });

    return product;
  },

  update: async (id: number, dto: UpdateProductDto) => {
    const product = await productRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404);

    if (dto.status === ProductStatus.ACTIVE) {
      await assertReadyForActivation(product);
    }

    const priceChanged = dto.price !== undefined && dto.price !== product.price;
    const updated = await productRepository.update(id, dto);

    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("products:all:*");

    businessLogger.log("PRODUCT_UPDATED", {
      service: "products",
      actor: { userId: null, role: "ADMIN" },
      target: { productId: id },
      metadata: { fields: Object.keys(dto) },
    });

    if (priceChanged) {
      auditLogger.log("PRICE_CHANGED", {
        service: "products",
        actor: { userId: null, role: "ADMIN" },
        target: { productId: id },
        metadata: { oldPrice: product.price, newPrice: dto.price },
      });
    }

    auditLogger.log("PRODUCT_UPDATED", {
      service: "products",
      actor: { userId: null, role: "ADMIN" },
      target: { productId: id },
      metadata: { fields: Object.keys(dto) },
    });

    // S4 — émis uniquement lors d'une VÉRITABLE transition vers ACTIVE
    // (pas si le produit était déjà ACTIVE), pour éviter un bruit de log
    // à chaque simple mise à jour d'un produit déjà actif.
    if (
      dto.status === ProductStatus.ACTIVE &&
      product.status !== ProductStatus.ACTIVE
    ) {
      eventBus.emit("product.activated", {
        productId: id,
        categoryId: product.categoryId,
      });
    }

    return updated;
  },

  delete: async (id: number) => {
    const product = await productRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404);

    // Cascade — un produit soft-supprimé ne doit plus immobiliser de fichiers
    // R2 ni de lignes de stock consultables/gérables (voir resolve.md #3).
    for (const image of product.images) {
      await deleteImage(image.url);
    }
    await productRepository.deleteImagesByProduct(id);
    await inventoryRepository.deleteByProduct(id);

    await productRepository.delete(id);
    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("products:all:*");

    businessLogger.log("PRODUCT_DELETED", {
      service: "products",
      actor: { userId: null, role: "ADMIN" },
      target: { productId: id },
      metadata: { name: product.name },
    });

    auditLogger.log("PRODUCT_DELETED", {
      service: "products",
      actor: { userId: null, role: "ADMIN" },
      target: { productId: id },
      metadata: { name: product.name },
    });

    return { numberOfProductsDeleted: 1 };
  },

  uploadImages: async (
    id: number,
    files: Express.Multer.File[],
    combinationId?: string,
  ) => {
    const product = await productRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404);

    if (combinationId) {
      const combination = await combinationRepository.findById(combinationId);
      if (!combination || combination.productId !== id)
        throw new AppError("Combination not found on this product", 404);
    }

    const uploadedUrls = await Promise.all(files.map((f) => uploadImage(f)));
    await productRepository.addImages(id, uploadedUrls, combinationId);

    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("products:all:*");

    return productRepository.findById(id);
  },

  deleteImage: async (id: number, imageId: string) => {
    const product = await productRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404);

    const image = await productRepository.findImageById(imageId);
    if (!image || image.productId !== id)
      throw new AppError("Image not found", 404);

    await deleteImage(image.url);
    await productRepository.deleteImage(imageId);

    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("products:all:*");

    return productRepository.findById(id);
  },
};
