import { prisma } from "../../shared/config/database";
import { CreateInventoryDto, UpdateInventoryDto } from "./inventory.schema";
import { settingService } from "../settings/setting.service";
import { SETTING_KEYS } from "../settings/setting.constants";
import { paginate } from "../../shared/utils/pagination";
import { eventBus } from "../../shared/events/event-bus";

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
    warehouse_id?: string;
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
      ...(query.warehouse_id && { warehouseId: query.warehouse_id }),
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
    productId: string,
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

  findAvailableOrdered: (productId: string, combinationId: string | null) =>
    prisma.inventory.findMany({
      where: { productId, combinationId, quantity: { gt: 0 } },
      orderBy: { createdAt: "asc" },
    }),

  sumAvailable: async (productId: string, combinationId: string | null) => {
    const result = await prisma.inventory.aggregate({
      where: { productId, combinationId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  },

  sumDirectStock: async (productId: string): Promise<number> => {
    const result = await prisma.inventory.aggregate({
      where: { productId, combinationId: null },
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

  search: (keyword: string, query: { page?: string; limit?: string }) => {
    const { skip, take } = paginate(query);
    const where = {
      product: { name: { contains: keyword, mode: "insensitive" as const } },
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

  decrementQuantity: async (id: string, quantity: number) => {
    const updated = await prisma.inventory.update({
      where: { id },
      data: { quantity: { decrement: quantity } },
    });

    eventBus.emit("inventory.quantity.changed", {
      inventoryId: updated.id,
      productId: updated.productId,
      warehouseId: updated.warehouseId,
      combinationId: updated.combinationId,
      quantity: updated.quantity,
    });

    return updated;
  },

  incrementQuantity: async (id: string, quantity: number) => {
    const updated = await prisma.inventory.update({
      where: { id },
      data: { quantity: { increment: quantity } },
    });

    eventBus.emit("inventory.quantity.changed", {
      inventoryId: updated.id,
      productId: updated.productId,
      warehouseId: updated.warehouseId,
      combinationId: updated.combinationId,
      quantity: updated.quantity,
    });

    return updated;
  },

  deleteByProduct: (productId: string) =>
    prisma.inventory.deleteMany({ where: { productId } }),

  findGroupedByProduct: async (query: {
    category?: string;
    warehouse_id?: string;
    low_stock?: string;
    out_of_stock?: string;
    page?: string;
    limit?: string;
  }) => {
    const { skip, take } = paginate(query);

    const threshold = await settingService.getNumber(
      SETTING_KEYS.INVENTORY_LOW_STOCK_THRESHOLD,
      10,
    );

    const scopeWhere = {
      ...(query.category && {
        product: {
          category: {
            name: { contains: query.category, mode: "insensitive" as const },
          },
        },
      }),
      ...(query.warehouse_id && { warehouseId: query.warehouse_id }),
    };

    const selectionWhere =
      query.out_of_stock === "true"
        ? { ...scopeWhere, quantity: 0 }
        : query.low_stock === "true"
          ? { ...scopeWhere, quantity: { lte: threshold, gt: 0 } }
          : scopeWhere;

    const distinctProducts = await prisma.inventory.findMany({
      where: selectionWhere,
      distinct: ["productId"],
      select: { productId: true },
      orderBy: { productId: "asc" },
    });

    const total = distinctProducts.length;
    const pageProductIds = distinctProducts
      .slice(skip, skip + take)
      .map((p) => p.productId);
    if (pageProductIds.length === 0) return { items: [] as any[], total };

    const lines = await prisma.inventory.findMany({
      where: {
        productId: { in: pageProductIds },
        ...(query.warehouse_id && { warehouseId: query.warehouse_id }),
      },
      select: {
        id: true,
        productId: true,
        warehouseId: true,
        combinationId: true,
        quantity: true,
        product: { select: { id: true, name: true, sku: true, status: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });

    const items = pageProductIds.map((productId) => {
      const productLines = lines.filter((l) => l.productId === productId);
      const hasVariants = productLines.some((l) => l.combinationId !== null);
      const totalQuantity = productLines.reduce(
        (sum, l) => sum + l.quantity,
        0,
      );

      return {
        product: productLines[0]?.product ?? null,
        hasVariants,
        totalQuantity,
        warehouseCount: new Set(productLines.map((l) => l.warehouseId)).size,
        combinationsWithStockCount: hasVariants
          ? new Set(productLines.map((l) => l.combinationId)).size
          : 0,
        lowStockLineCount: productLines.filter(
          (l) => l.quantity > 0 && l.quantity <= threshold,
        ).length,
        outOfStockLineCount: productLines.filter((l) => l.quantity === 0)
          .length,
        lines: hasVariants
          ? undefined
          : productLines.map((l) => ({
              id: l.id,
              warehouseId: l.warehouseId,
              warehouse: l.warehouse,
              quantity: l.quantity,
            })),
      };
    });

    return { items, total };
  },

  findLinesByProduct: (
    productId: string,
    query: { page?: string; limit?: string },
  ) => {
    const { skip, take } = paginate(query);
    const where = { productId };
    return Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take,
        include: inventoryInclude,
        orderBy: [{ combinationId: "asc" }, { warehouseId: "asc" }],
      }),
      prisma.inventory.count({ where }),
    ]);
  },
};
