import { warehouseRepository } from "./warehouse.repository";
import { CreateWarehouseDto, UpdateWarehouseDto } from "./warehouse.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";
import { businessLogger } from "../../shared/logger";
import { prisma } from "../../shared/config/database";

const CACHE_KEYS = {
  all: "warehouses:all",
  single: (id: string) => `warehouses:${id}`,
};

export const warehouseService = {
  getAll: async () => {
    const cached = await cache.get(CACHE_KEYS.all);
    if (cached) return cached;
    const warehouses = await warehouseRepository.findAll();
    await cache.set(CACHE_KEYS.all, warehouses);
    return warehouses;
  },

  getById: async (id: string) => {
    const cacheKey = CACHE_KEYS.single(id);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
    const warehouse = await warehouseRepository.findById(id);
    if (!warehouse) throw new AppError("Warehouse not found", 404);
    await cache.set(cacheKey, warehouse);
    return warehouse;
  },

  getInventory: async (id: string) => {
    const warehouse = await warehouseRepository.findById(id);
    if (!warehouse) throw new AppError("Warehouse not found", 404);

    const items = await prisma.inventory.findMany({
      where: { warehouseId: id },
      include: {
        product: {
          select: { id: true, name: true, category: true, price: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

    return {
      warehouse: { ...warehouse, totalUnits },
      items,
    };
  },
  create: async (dto: CreateWarehouseDto) => {
    const warehouse = await warehouseRepository.create(dto);
    await cache.del(CACHE_KEYS.all);

    businessLogger.log("WAREHOUSE_CREATED", {
      service: "warehouses",
      actor: { userId: null, role: "ADMIN" },
      target: { warehouseId: warehouse.id },
      metadata: { name: warehouse.name, location: warehouse.location },
    });

    return warehouse;
  },

  update: async (id: string, dto: UpdateWarehouseDto) => {
    const warehouse = await warehouseRepository.findById(id);
    if (!warehouse) throw new AppError("Warehouse not found", 404);

    const updated = await warehouseRepository.update(id, dto);
    await cache.del(CACHE_KEYS.single(id), CACHE_KEYS.all);

    businessLogger.log("WAREHOUSE_UPDATED", {
      service: "warehouses",
      actor: { userId: null, role: "ADMIN" },
      target: { warehouseId: id },
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  },

  delete: async (id: string) => {
    const warehouse = await warehouseRepository.findById(id);
    if (!warehouse) throw new AppError("Warehouse not found", 404);

    const stockCount = await prisma.inventory.count({
      where: { warehouseId: id, quantity: { gt: 0 } },
    });
    if (stockCount > 0) {
      throw new AppError(
        `Cannot delete warehouse with ${stockCount} inventory item(s) still in stock — remove stock first`,
        400,
      );
    }

    await warehouseRepository.delete(id);
    await cache.del(CACHE_KEYS.single(id), CACHE_KEYS.all);

    businessLogger.log("WAREHOUSE_DELETED", {
      service: "warehouses",
      actor: { userId: null, role: "ADMIN" },
      target: { warehouseId: id },
      metadata: { name: warehouse.name },
    });

    return { message: "Warehouse deleted successfully" };
  },
};
