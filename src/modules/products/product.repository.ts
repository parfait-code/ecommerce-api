import { prisma } from "../../shared/config/database";
import { CreateProductDto, UpdateProductDto } from "./product.schema";
import { paginate } from "../../shared/utils/pagination";
import { parseProductSort } from "../../shared/utils/product-sort";

export interface ProductListQuery {
  page?: string;
  limit?: string;
  categoryId?: string;
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  tags?: string;
  sort?: string;
}

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: "asc" as const } },
  combinations: {
    where: { isActive: true },
    include: {
      values: {
        include: {
          attributeDefinition: { select: { id: true, name: true, slug: true } },
          attributeOption: {
            select: { id: true, value: true, colorHex: true },
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
  attributeSelections: {
    include: {
      attributeDefinition: { select: { id: true, name: true, slug: true } },
      attributeOption: { select: { id: true, value: true, colorHex: true } },
    },
  },
};

export const productRepository = {
  findAll: async (query: ProductListQuery, includeInactive = false) => {
    const { skip, take } = paginate(query);

    const minPrice =
      query.minPrice !== undefined ? Number(query.minPrice) : undefined;
    const maxPrice =
      query.maxPrice !== undefined ? Number(query.maxPrice) : undefined;
    const tagSlugs = query.tags
      ? query.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    const where = {
      ...(!includeInactive && { status: "ACTIVE" as const }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: "insensitive" as const } },
          { sku: { contains: query.search, mode: "insensitive" as const } },
        ],
      }),
      ...((minPrice !== undefined || maxPrice !== undefined) && {
        price: {
          ...(minPrice !== undefined &&
            !Number.isNaN(minPrice) && { gte: minPrice }),
          ...(maxPrice !== undefined &&
            !Number.isNaN(maxPrice) && { lte: maxPrice }),
        },
      }),
      ...(tagSlugs &&
        tagSlugs.length > 0 && {
          tags: { some: { tag: { slug: { in: tagSlugs } } } },
        }),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: parseProductSort(query.sort),
        include: productInclude,
      }),
      prisma.product.count({ where }),
    ]);
    return [items, total] as const;
  },

  findById: (id: string, includeInactive = false) =>
    prisma.product.findUnique({
      where: {
        id,
        ...(!includeInactive && { status: "ACTIVE" as const }),
      },
      include: productInclude,
    }),

  create: (data: CreateProductDto) =>
    prisma.product.create({ data, include: productInclude }),

  update: (id: string, data: UpdateProductDto) =>
    prisma.product.update({ where: { id }, data, include: productInclude }),

  delete: (id: string) => prisma.product.delete({ where: { id } }),

  addImages: (productId: string, urls: string[], combinationId?: string) =>
    prisma.productImage.createMany({
      data: urls.map((url, index) => ({
        productId,
        url,
        combinationId: combinationId ?? null,
        position: index,
        isPrimary: index === 0,
      })),
    }),

  deleteImage: (imageId: string) =>
    prisma.productImage.delete({ where: { id: imageId } }),

  findImageById: (id: string) =>
    prisma.productImage.findUnique({ where: { id } }),

  deleteImagesByProduct: (productId: string) =>
    prisma.productImage.deleteMany({ where: { productId } }),
};
