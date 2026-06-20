import { prisma } from "../../shared/config/database";
import { CreateInventoryDto, UpdateInventoryDto } from "./inventory.schema";
import { paginate } from "../../shared/utils/pagination";

const inventoryInclude = {
  product: true,
  warehouse: true,
  variant: {
    include: {
      attributeValues: {
        include: {
          attributeDefinition: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  },
};

export const inventoryRepository = {
  findAll: (query: {
    category?: string;
    location?: string;
    page?: string;
    limit?: string;
  }) => {
    const { skip, take } = paginate(query);
    const where = {
      ...(query.category && {
        product: {
          category: {
            name: { contains: query.category, mode: "insensitive" as const },
          },
        },
      }),
      ...(query.location && {
        warehouse: { location: { contains: query.location } },
      }),
    };
    return Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take,
        include: inventoryInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.inventory.count({ where }),
    ]);
  },

  findById: (id: string) =>
    prisma.inventory.findUnique({ where: { id }, include: inventoryInclude }),

  findByProductAndWarehouse: (
    productId: number,
    warehouseId: string,
    variantId?: string,
  ) => {
    if (variantId) {
      return prisma.inventory.findUnique({
        where: {
          productId_warehouseId_variantId: {
            productId,
            warehouseId,
            variantId,
          },
        },
        include: inventoryInclude,
      });
    }
    return prisma.inventory.findFirst({
      where: { productId, warehouseId, variantId: null },
      include: inventoryInclude,
    });
  },

  findLowStock: (threshold: number) =>
    prisma.inventory.findMany({
      where: { quantity: { lte: threshold, gt: 0 } },
      include: inventoryInclude,
    }),

  findOutOfStock: () =>
    prisma.inventory.findMany({
      where: { quantity: 0 },
      include: inventoryInclude,
    }),

  search: (keyword: string) =>
    prisma.inventory.findMany({
      where: { product: { name: { contains: keyword, mode: "insensitive" } } },
      include: inventoryInclude,
    }),

  create: (data: CreateInventoryDto) =>
    prisma.inventory.create({
      data: {
        productId: data.product_id,
        warehouseId: data.warehouse_id,
        variantId: data.variant_id ?? null,
        quantity: data.quantity,
      },
      include: inventoryInclude,
    }),

  update: (id: string, data: UpdateInventoryDto) =>
    prisma.inventory.update({
      where: { id },
      data: {
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.warehouse_id && { warehouseId: data.warehouse_id }),
      },
      include: inventoryInclude,
    }),

  delete: (id: string) => prisma.inventory.delete({ where: { id } }),

  decrementQuantity: (id: string, quantity: number) =>
    prisma.inventory.update({
      where: { id },
      data: { quantity: { decrement: quantity } },
    }),

  incrementQuantity: (id: string, quantity: number) =>
    prisma.inventory.update({
      where: { id },
      data: { quantity: { increment: quantity } },
    }),
};
