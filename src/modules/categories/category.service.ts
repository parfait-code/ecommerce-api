import { categoryRepository } from "./category.repository";
import { CreateCategoryDto, UpdateCategoryDto } from "./category.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";
import { businessLogger, auditLogger } from "../../shared/logger";
import {
  uploadImage,
  deleteImage as deleteR2Image,
} from "../../shared/utils/upload";
import { prisma } from "../../shared/config/database";
import { promotionRepository } from "../promotions/promotion.repository";
import { getBestPricing } from "../promotions/promotion.pricing";

const CACHE_KEYS = {
  all: "categories:all",
  single: (id: string) => `categories:${id}`,
  bySlug: (slug: string) => `categories:slug:${slug}`,
  products: (
    slug: string,
    page: number,
    limit: number,
    search?: string,
    minPrice?: string,
    maxPrice?: string,
    tags?: string,
    sort?: string,
  ) =>
    `categories:${slug}:products:${page}:${limit}` +
    (search ? `:s=${search}` : "") +
    (minPrice ? `:min=${minPrice}` : "") +
    (maxPrice ? `:max=${maxPrice}` : "") +
    (tags ? `:tags=${tags}` : "") +
    (sort ? `:sort=${sort}` : ""),
};

const attachTotalProductCount = async (
  category: any,
  includeInactive: boolean,
) => {
  const descendantIds = await categoryRepository.findDescendantIds(category.id);
  if (descendantIds.length === 0) return category;

  const total = await categoryRepository.countProductsForCategoryIds(
    [category.id, ...descendantIds],
    includeInactive,
  );

  return { ...category, _count: { ...category._count, products: total } };
};

const buildTotalCountResolver = async (includeInactive: boolean) => {
  const [allCategories, grouped] = await Promise.all([
    categoryRepository.findAllIdsWithParent(),
    categoryRepository.countProductsGroupedByCategory(includeInactive),
  ]);

  const directCount = new Map<string, number>();
  for (const row of grouped as any[]) {
    directCount.set(row.categoryId, row._count._all);
  }

  const childrenMap = new Map<string, string[]>();
  for (const c of allCategories) {
    if (c.parentId) {
      const list = childrenMap.get(c.parentId) ?? [];
      list.push(c.id);
      childrenMap.set(c.parentId, list);
    }
  }

  const memo = new Map<string, number>();
  const resolve = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    let total = directCount.get(id) ?? 0;
    for (const childId of childrenMap.get(id) ?? []) {
      total += resolve(childId);
    }
    memo.set(id, total);
    return total;
  };

  return resolve;
};

export const categoryService = {
  getAll: async (includeInactive = false) => {
    if (includeInactive) {
      const categories = await categoryRepository.findAll(true);
      const resolveTotal = await buildTotalCountResolver(true);
      return categories.map((c) => ({
        ...c,
        _count: { ...c._count, products: resolveTotal(c.id) },
      }));
    }

    const cached = await cache.get(CACHE_KEYS.all);
    if (cached) return cached;

    const categories = await categoryRepository.findAll(false);
    const resolveTotal = await buildTotalCountResolver(false);
    const withTotals = categories.map((c) => ({
      ...c,
      _count: { ...c._count, products: resolveTotal(c.id) },
    }));

    await cache.set(CACHE_KEYS.all, withTotals);
    return withTotals;
  },

  getById: async (id: string, includeInactive = false) => {
    const cacheKey = CACHE_KEYS.single(id);
    if (!includeInactive) {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    }

    const category = await categoryRepository.findById(id, includeInactive);
    if (!category) throw new AppError("Category not found", 404);
    if (!includeInactive && !category.isActive)
      throw new AppError("Category not found", 404);

    const withTotal = await attachTotalProductCount(category, includeInactive);

    if (!includeInactive) await cache.set(cacheKey, withTotal);
    return withTotal;
  },

  getBySlug: async (slug: string, includeInactive = false) => {
    const cacheKey = CACHE_KEYS.bySlug(slug);
    if (!includeInactive) {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    }

    const category = await categoryRepository.findBySlug(slug, includeInactive);
    if (!category || (!includeInactive && !category.isActive))
      throw new AppError("Category not found", 404);

    const withTotal = await attachTotalProductCount(category, includeInactive);

    if (!includeInactive) await cache.set(cacheKey, withTotal);
    return withTotal;
  },

  getProducts: async (
    slug: string,
    query: {
      page?: string;
      limit?: string;
      search?: string;
      minPrice?: string;
      maxPrice?: string;
      tags?: string;
      sort?: string;
    },
    includeInactive = false,
  ) => {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const cacheKey = CACHE_KEYS.products(
      slug,
      page,
      limit,
      query.search,
      query.minPrice,
      query.maxPrice,
      query.tags,
      query.sort,
    );

    if (!includeInactive) {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    }

    const category = await categoryRepository.findBySlug(slug, includeInactive);
    if (!category || (!includeInactive && !category.isActive))
      throw new AppError("Category not found", 404);

    const descendantIds = await categoryRepository.findDescendantIds(
      category.id,
    );
    const categoryIds = [category.id, ...descendantIds];

    const [items, total] = await categoryRepository.findProducts(
      categoryIds,
      query,
      includeInactive,
    );

    const activeDiscounts = await promotionRepository.findActiveDiscounts();
    const itemsWithPricing = items.map((item: any) => ({
      ...item,
      pricing: getBestPricing(item, activeDiscounts as any),
    }));

    const result = {
      category: { id: category.id, name: category.name, slug: category.slug },
      items: itemsWithPricing,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    if (!includeInactive) await cache.set(cacheKey, result);
    return result;
  },

  create: async (dto: CreateCategoryDto) => {
    const existingName = await categoryRepository.existsByName(dto.name);
    if (existingName) throw new AppError("Category name already taken", 409);

    const existingSlug = await categoryRepository.existsBySlug(dto.slug);
    if (existingSlug) throw new AppError("Category slug already taken", 409);

    if (dto.parentId) {
      const parent = await categoryRepository.findById(dto.parentId);
      if (!parent) throw new AppError("Parent category not found", 404);
    }

    const category = await categoryRepository.create(dto);
    await cache.del(CACHE_KEYS.all);

    businessLogger.log("CATEGORY_CREATED", {
      service: "categories",
      actor: { userId: null, role: "ADMIN" },
      target: { categoryId: category.id },
      metadata: { name: category.name, slug: category.slug },
    });

    auditLogger.log("CATEGORY_CREATED", {
      service: "categories",
      actor: { userId: null, role: "ADMIN" },
      target: { categoryId: category.id },
      metadata: { name: category.name, slug: category.slug },
    });

    return category;
  },

  update: async (id: string, dto: UpdateCategoryDto) => {
    const category = await categoryRepository.findById(id);
    if (!category) throw new AppError("Category not found", 404);

    if (dto.name && dto.name !== category.name) {
      const existingName = await categoryRepository.existsByName(dto.name);
      if (existingName) throw new AppError("Category name already taken", 409);
    }

    if (dto.slug && dto.slug !== category.slug) {
      const existingSlug = await categoryRepository.existsBySlug(dto.slug);
      if (existingSlug) throw new AppError("Category slug already taken", 409);
    }

    if (dto.parentId) {
      if (dto.parentId === id)
        throw new AppError("A category cannot be its own parent", 400);

      const descendantIds = await categoryRepository.findDescendantIds(id);
      if (descendantIds.includes(dto.parentId))
        throw new AppError(
          "A category cannot have one of its own descendants as parent",
          400,
        );

      const parent = await categoryRepository.findById(dto.parentId);
      if (!parent) throw new AppError("Parent category not found", 404);
    }

    const updated = await categoryRepository.update(id, dto);

    await cache.del(
      CACHE_KEYS.single(id),
      CACHE_KEYS.bySlug(category.slug),
      CACHE_KEYS.all,
    );

    businessLogger.log("CATEGORY_UPDATED", {
      service: "categories",
      actor: { userId: null, role: "ADMIN" },
      target: { categoryId: id },
      metadata: { fields: Object.keys(dto) },
    });

    auditLogger.log("CATEGORY_UPDATED", {
      service: "categories",
      actor: { userId: null, role: "ADMIN" },
      target: { categoryId: id },
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  },

  delete: async (id: string) => {
    const category = await categoryRepository.findById(id);
    if (!category) throw new AppError("Category not found", 404);

    if (category._count.products > 0)
      throw new AppError(
        `Cannot delete category with ${category._count.products} product(s) attached`,
        400,
      );

    const discountCount = await prisma.discount.count({
      where: { categoryId: id },
    });
    if (discountCount > 0)
      throw new AppError(
        `Cannot delete category: ${discountCount} discount(s) still target it — remove or retarget them first`,
        400,
      );

    const children = category.children;

    await categoryRepository.delete(id);

    await cache.del(
      CACHE_KEYS.single(id),
      CACHE_KEYS.bySlug(category.slug),
      CACHE_KEYS.all,
      ...children.flatMap((c) => [
        CACHE_KEYS.single(c.id),
        CACHE_KEYS.bySlug(c.slug),
      ]),
    );

    businessLogger.log("CATEGORY_DELETED", {
      service: "categories",
      actor: { userId: null, role: "ADMIN" },
      target: { categoryId: id },
      metadata: {
        name: category.name,
        slug: category.slug,
        orphanedChildren: children.length,
      },
    });

    auditLogger.log("CATEGORY_DELETED", {
      service: "categories",
      actor: { userId: null, role: "ADMIN" },
      target: { categoryId: id },
      metadata: { name: category.name },
    });

    return { message: "Category deleted successfully" };
  },

  uploadAssets: async (
    id: string,
    files: {
      image?: Express.Multer.File[];
      icon?: Express.Multer.File[];
    },
  ) => {
    const category = await categoryRepository.findById(id);
    if (!category) throw new AppError("Category not found", 404);

    if (!files.image?.[0] && !files.icon?.[0]) {
      throw new AppError(
        "No files uploaded (expected 'image' and/or 'icon')",
        400,
      );
    }

    const updateData: { imageUrl?: string; iconUrl?: string } = {};

    if (files.image?.[0]) {
      const newImageUrl = await uploadImage(files.image[0], "categories");
      if (category.imageUrl) await deleteR2Image(category.imageUrl);
      updateData.imageUrl = newImageUrl;
    }

    if (files.icon?.[0]) {
      const newIconUrl = await uploadImage(files.icon[0], "categories/icons");
      if (category.iconUrl) await deleteR2Image(category.iconUrl);
      updateData.iconUrl = newIconUrl;
    }

    const updated = await categoryRepository.update(id, updateData);

    await cache.del(
      CACHE_KEYS.single(id),
      CACHE_KEYS.bySlug(category.slug),
      CACHE_KEYS.all,
    );

    businessLogger.log("CATEGORY_UPDATED", {
      service: "categories",
      actor: { userId: null, role: "ADMIN" },
      target: { categoryId: id },
      metadata: { fields: Object.keys(updateData) },
    });

    return updated;
  },

  deleteAsset: async (id: string, asset: "image" | "icon") => {
    const category = await categoryRepository.findById(id);
    if (!category) throw new AppError("Category not found", 404);

    const url = asset === "image" ? category.imageUrl : category.iconUrl;
    if (!url) throw new AppError(`No ${asset} set on this category`, 404);

    await deleteR2Image(url);

    const updated = await categoryRepository.update(id, {
      [asset === "image" ? "imageUrl" : "iconUrl"]: null,
    } as UpdateCategoryDto);

    await cache.del(
      CACHE_KEYS.single(id),
      CACHE_KEYS.bySlug(category.slug),
      CACHE_KEYS.all,
    );

    businessLogger.log("CATEGORY_UPDATED", {
      service: "categories",
      actor: { userId: null, role: "ADMIN" },
      target: { categoryId: id },
      metadata: { fields: [asset === "image" ? "imageUrl" : "iconUrl"] },
    });

    return updated;
  },
};
