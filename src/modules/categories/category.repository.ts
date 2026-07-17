import { prisma } from "../../shared/config/database";
import { CreateCategoryDto, UpdateCategoryDto } from "./category.schema";

const categoryInclude = (includeInactive: boolean) => ({
  parent: { select: { id: true, name: true, slug: true } },
  children: { select: { id: true, name: true, slug: true } },
  _count: {
    select: {
      products: includeInactive
        ? true
        : { where: { status: "ACTIVE" as const } },
    },
  },
});

export const categoryRepository = {
  findAll: (includeInactive = false) =>
    prisma.category.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: categoryInclude(includeInactive),
      orderBy: { name: "asc" },
    }),

  findById: (id: string, includeInactive = false) =>
    prisma.category.findUnique({
      where: { id },
      include: categoryInclude(includeInactive),
    }),

  findBySlug: (slug: string, includeInactive = false) =>
    prisma.category.findUnique({
      where: { slug },
      include: categoryInclude(includeInactive),
    }),

  findProducts: (
    categoryIds: string[],
    query: { page?: string; limit?: string },
    includeInactive = false,
  ) => {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where = {
      categoryId: { in: categoryIds },
      ...(!includeInactive && { status: "ACTIVE" as const }),
    };

    return Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { category: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);
  },

  findDescendantIds: async (categoryId: string): Promise<string[]> => {
    const result: string[] = [];
    let currentLevel = [categoryId];

    while (currentLevel.length > 0) {
      const children = await prisma.category.findMany({
        where: { parentId: { in: currentLevel } },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length === 0) break;
      result.push(...childIds);
      currentLevel = childIds;
    }

    return result;
  },

  create: (data: CreateCategoryDto) =>
    prisma.category.create({
      data,
      include: categoryInclude(true),
    }),

  update: (id: string, data: UpdateCategoryDto) =>
    prisma.category.update({
      where: { id },
      data,
      include: categoryInclude(true),
    }),

  delete: (id: string) => prisma.category.delete({ where: { id } }),

  existsByName: (name: string) =>
    prisma.category.findUnique({ where: { name } }),

  existsBySlug: (slug: string) =>
    prisma.category.findUnique({ where: { slug } }),

  // ── Nouveau — support du comptage récursif (direct + descendants) ────────

  // Utilisé pour getAll(): une seule requête groupée pour toutes les
  // catégories, plutôt qu'une requête de comptage par catégorie.
  countProductsGroupedByCategory: (includeInactive: boolean) =>
    prisma.product.groupBy({
      by: ["categoryId"],
      where: includeInactive ? undefined : { status: "ACTIVE" as const },
      _count: { _all: true },
    }),

  findAllIdsWithParent: () =>
    prisma.category.findMany({ select: { id: true, parentId: true } }),

  // Utilisé pour getById()/getBySlug(): comptage direct sur un ensemble
  // d'ids déjà résolu (catégorie + descendants).
  countProductsForCategoryIds: (
    categoryIds: string[],
    includeInactive = false,
  ) =>
    prisma.product.count({
      where: {
        categoryId: { in: categoryIds },
        ...(!includeInactive && { status: "ACTIVE" as const }),
      },
    }),
};
