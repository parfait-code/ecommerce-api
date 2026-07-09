import { prisma } from "../../shared/config/database";
import { CreateCategoryDto, UpdateCategoryDto } from "./category.schema";

const categoryInclude = {
  parent: { select: { id: true, name: true, slug: true } },
  children: { select: { id: true, name: true, slug: true } },
  _count: { select: { products: { where: { deletedAt: null } } } },
};

export const categoryRepository = {
  findAll: (includeInactive = false) =>
    prisma.category.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: categoryInclude,
      orderBy: { name: "asc" },
    }),

  findById: (id: string) =>
    prisma.category.findUnique({
      where: { id },
      include: categoryInclude,
    }),

  findBySlug: (slug: string) =>
    prisma.category.findUnique({
      where: { slug },
      include: categoryInclude,
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
      deletedAt: null,
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

  // Résout tous les descendants (enfants, petits-enfants, ...) d'une catégorie.
  // Jamais l'inverse : un ciblage sur une catégorie parente couvre ses enfants,
  // une catégorie enfant ne remonte jamais vers son parent.
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
      include: categoryInclude,
    }),

  update: (id: string, data: UpdateCategoryDto) =>
    prisma.category.update({
      where: { id },
      data,
      include: categoryInclude,
    }),

  delete: (id: string) => prisma.category.delete({ where: { id } }),

  existsByName: (name: string) =>
    prisma.category.findUnique({ where: { name } }),

  existsBySlug: (slug: string) =>
    prisma.category.findUnique({ where: { slug } }),
};
