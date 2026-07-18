import { productRepository } from "./product.repository";
import { combinationRepository } from "../combinations/combination.repository";
import { attributeRepository } from "../attributes/attribute.repository";
import { promotionRepository } from "../promotions/promotion.repository";
import { categoryRepository } from "../categories/category.repository";
import { getBestPricing } from "../promotions/promotion.pricing";
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
  minPrice?: string;
  maxPrice?: string;
  tags?: string;
  sort?: string;
};

const CACHE_KEYS = {
  all: (
    page: number,
    limit: number,
    categoryId?: string,
    search?: string,
    minPrice?: string,
    maxPrice?: string,
    tags?: string,
    sort?: string,
  ) =>
    `products:all:${page}:${limit}` +
    (categoryId ? `:cat=${categoryId}` : "") +
    (search ? `:s=${search}` : "") +
    (minPrice ? `:min=${minPrice}` : "") +
    (maxPrice ? `:max=${maxPrice}` : "") +
    (tags ? `:tags=${tags}` : "") +
    (sort ? `:sort=${sort}` : ""),
  single: (id: string) => `products:${id}`,
};

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
      query.minPrice,
      query.maxPrice,
      query.tags,
      query.sort,
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

  getById: async (id: string, includeInactive = false) => {
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
    const category = await categoryRepository.findById(dto.categoryId);
    if (!category) throw new AppError("Category not found", 404);

    const product = await productRepository.create({
      ...dto,
      status: ProductStatus.DRAFT,
    });
    await cache.delByPattern("products:all:*");
    await cache.delByPattern("categories:*");

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

  update: async (id: string, dto: UpdateProductDto) => {
    const product = await productRepository.findById(id, true);
    if (!product) throw new AppError("Product not found", 404);

    if (dto.status === ProductStatus.ACTIVE) {
      await assertReadyForActivation(product);
    }

    const priceChanged = dto.price !== undefined && dto.price !== product.price;
    const updated = await productRepository.update(id, dto);

    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("products:all:*");
    await cache.delByPattern("categories:*");

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

  delete: async (id: string) => {
    const product = await productRepository.findById(id, true);
    if (!product) throw new AppError("Product not found", 404);

    await productRepository.delete(id);

    await cache.del(CACHE_KEYS.single(id));
    await cache.delByPattern("products:all:*");
    await cache.delByPattern("categories:*");

    businessLogger.log("PRODUCT_DELETED", {
      service: "products",
      actor: { userId: null, role: "ADMIN" },
      target: { productId: id },
      metadata: { name: product.name, sku: product.sku },
    });

    auditLogger.log("PRODUCT_DELETED", {
      service: "products",
      actor: { userId: null, role: "ADMIN" },
      target: { productId: id },
      metadata: { name: product.name, sku: product.sku },
    });

    return { message: "Product deleted successfully" };
  },

  uploadImages: async (
    id: string,
    files: Express.Multer.File[],
    combinationId?: string,
  ) => {
    const product = await productRepository.findById(id, true);
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

  deleteImage: async (id: string, imageId: string) => {
    const product = await productRepository.findById(id, true);
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
