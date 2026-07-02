import { productRepository } from "./product.repository";
import { variantRepository } from "../variants/variant.repository";
import { promotionRepository } from "../promotions/promotion.repository";
import { getBestPricing } from "../promotions/promotion.pricing";
import { CreateProductDto, UpdateProductDto } from "./product.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";
import { uploadImage, deleteImage } from "../../shared/utils/upload";
import { businessLogger, auditLogger } from "../../shared/logger";

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

export const productService = {
  getAll: async (query: ProductQuery) => {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const cacheKey = CACHE_KEYS.all(
      page,
      limit,
      query.categoryId,
      query.search,
    );

    const cached = await cache.get<{
      items: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);
    if (cached) return cached;

    const [items, total] = await productRepository.findAll(query);
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

    await cache.set(cacheKey, result);
    return result;
  },

  getById: async (id: number) => {
    const cacheKey = CACHE_KEYS.single(id);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const product = await productRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404);

    const activeDiscounts = await promotionRepository.findActiveDiscounts();
    const productWithPricing = {
      ...product,
      pricing: getBestPricing(product, activeDiscounts as any),
    };

    await cache.set(cacheKey, productWithPricing);
    return productWithPricing;
  },

  create: async (dto: CreateProductDto) => {
    const product = await productRepository.create(dto);
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

    return updated;
  },

  delete: async (id: number) => {
    const product = await productRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404);

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
    variantId?: string,
  ) => {
    const product = await productRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404);

    if (variantId) {
      const variant = await variantRepository.findById(variantId);
      if (!variant || variant.productId !== id)
        throw new AppError("Variant not found on this product", 404);
    }

    const uploadedUrls = await Promise.all(files.map((f) => uploadImage(f)));
    await productRepository.addImages(id, uploadedUrls, variantId);

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
