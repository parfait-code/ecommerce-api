import { prisma } from "../../shared/config/database";
import { CreateInventoryDto, UpdateInventoryDto } from "./inventory.schema";
import { paginate } from "../../shared/utils/pagination";

const inventoryInclude = {
  product: true,
  warehouse: true,
  combination: {
    include: {
      values: {
        include: {
          attributeDefinition: { select: { id: true, name: true, slug: true } },
          attributeOption: {
            select: { id: true, value: true, colorHex: true },
          },
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
    combinationId?: string,
  ) => {
    if (combinationId) {
      return prisma.inventory.findUnique({
        where: {
          productId_warehouseId_combinationId: {
            productId,
            warehouseId,
            combinationId,
          },
        },
        include: inventoryInclude,
      });
    }
    return prisma.inventory.findFirst({
      where: { productId, warehouseId, combinationId: null },
      include: inventoryInclude,
    });
  },

  // ── Utilisé pour la vérification & la réservation FIFO multi-entrepôt ──
  findAvailableOrdered: (productId: number, combinationId: string | null) =>
    prisma.inventory.findMany({
      where: { productId, combinationId, quantity: { gt: 0 } },
      orderBy: { createdAt: "asc" },
    }),

  sumAvailable: async (productId: number, combinationId: string | null) => {
    const result = await prisma.inventory.aggregate({
      where: { productId, combinationId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
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
        combinationId: data.combination_id ?? null,
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
