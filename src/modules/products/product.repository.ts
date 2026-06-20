import { prisma } from "../../shared/config/database";
import { CreateProductDto, UpdateProductDto } from "./product.schema";
import { paginate } from "../../shared/utils/pagination";

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: "asc" as const } },
  variants: {
    where: { isActive: true },
    include: {
      attributeValues: {
        include: {
          attributeDefinition: {
            select: { id: true, name: true, slug: true, type: true },
          },
        },
      },
      inventory: { select: { quantity: true, warehouseId: true } },
      images: { orderBy: { position: "asc" as const } },
    },
  },
  attributeValues: {
    include: {
      attributeDefinition: {
        select: { id: true, name: true, slug: true, type: true, unit: true },
      },
    },
  },
};

export const productRepository = {
  findAll: async (query: {
    page?: string;
    limit?: string;
    categoryId?: string;
  }) => {
    const { skip, take } = paginate(query);
    const where = {
      deletedAt: null,
      ...(query.categoryId && { categoryId: query.categoryId }),
    };
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: productInclude,
      }),
      prisma.product.count({ where }),
    ]);
    return [items, total] as const;
  },

  findById: (id: number) =>
    prisma.product.findUnique({
      where: { id, deletedAt: null },
      include: productInclude,
    }),

  create: (data: CreateProductDto) =>
    prisma.product.create({ data, include: productInclude }),

  update: (id: number, data: UpdateProductDto) =>
    prisma.product.update({ where: { id }, data, include: productInclude }),

  delete: (id: number) =>
    prisma.product.update({ where: { id }, data: { deletedAt: new Date() } }),

  // ── Images ────────────────────────────────────────────────────────────────

  addImages: (productId: number, urls: string[], variantId?: string) =>
    prisma.productImage.createMany({
      data: urls.map((url, index) => ({
        productId,
        url,
        variantId: variantId ?? null,
        position: index,
        isPrimary: index === 0,
      })),
    }),

  deleteImage: (imageId: string) =>
    prisma.productImage.delete({ where: { id: imageId } }),

  findImageById: (id: string) =>
    prisma.productImage.findUnique({ where: { id } }),
};
