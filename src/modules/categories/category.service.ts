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

const CACHE_KEYS = {
  all: "categories:all",
  single: (id: string) => `categories:${id}`,
  bySlug: (slug: string) => `categories:slug:${slug}`,
  products: (slug: string, page: number, limit: number) =>
    `categories:${slug}:products:${page}:${limit}`,
};

export const categoryService = {
  getAll: async (includeInactive = false) => {
    // Admin explicite (includeInactive) → pas de cache partagé avec la vue publique
    if (includeInactive) {
      return categoryRepository.findAll(true);
    }

    const cached = await cache.get(CACHE_KEYS.all);
    if (cached) return cached;

    const categories = await categoryRepository.findAll(false);
    await cache.set(CACHE_KEYS.all, categories);
    return categories;
  },

  getById: async (id: string, includeInactive = false) => {
    const cacheKey = CACHE_KEYS.single(id);
    if (!includeInactive) {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    }

    const category = await categoryRepository.findById(id);
    if (!category) throw new AppError("Category not found", 404);
    if (!includeInactive && !category.isActive)
      throw new AppError("Category not found", 404);

    if (!includeInactive) await cache.set(cacheKey, category);
    return category;
  },

  // U1 — une catégorie désactivée n'est plus consultable via cette route publique
  getBySlug: async (slug: string) => {
    const cacheKey = CACHE_KEYS.bySlug(slug);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const category = await categoryRepository.findBySlug(slug);
    if (!category || !category.isActive)
      throw new AppError("Category not found", 404);

    await cache.set(cacheKey, category);
    return category;
  },

  // U1 — idem, les produits d'une catégorie désactivée ne sont plus listables publiquement
  getProducts: async (
    slug: string,
    query: { page?: string; limit?: string },
  ) => {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const cacheKey = CACHE_KEYS.products(slug, page, limit);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const category = await categoryRepository.findBySlug(slug);
    if (!category || !category.isActive)
      throw new AppError("Category not found", 404);

    const [items, total] = await categoryRepository.findProducts(slug, query);
    const result = {
      category: { id: category.id, name: category.name, slug: category.slug },
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await cache.set(cacheKey, result);
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

    // resolve.md #4 — bloque tant que la catégorie est ciblée par au moins
    // un Discount, quel que soit le statut de la promotion parente, plutôt
    // que de laisser le FK SetNull créer un Discount orphelin sans cible.
    const discountCount = await prisma.discount.count({
      where: { categoryId: id },
    });
    if (discountCount > 0)
      throw new AppError(
        `Cannot delete category: ${discountCount} discount(s) still target it — remove or retarget them first`,
        400,
      );

    await categoryRepository.delete(id);

    await cache.del(
      CACHE_KEYS.single(id),
      CACHE_KEYS.bySlug(category.slug),
      CACHE_KEYS.all,
    );

    businessLogger.log("CATEGORY_DELETED", {
      service: "categories",
      actor: { userId: null, role: "ADMIN" },
      target: { categoryId: id },
      metadata: { name: category.name, slug: category.slug },
    });

    auditLogger.log("CATEGORY_DELETED", {
      service: "categories",
      actor: { userId: null, role: "ADMIN" },
      target: { categoryId: id },
      metadata: { name: category.name },
    });

    return { message: "Category deleted successfully" };
  },

  // ── Upload image / icône ────────────────────────────────────────────────────
  // Aligné sur le comportement produit : l'API uploade elle-même le fichier
  // vers R2 et stocke l'URL résultante — le frontend n'a plus besoin de
  // connaître/saisir une URL manuellement.
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
