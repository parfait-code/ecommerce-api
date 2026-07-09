import { inventoryRepository } from "./inventory.repository";
import { warehouseRepository } from "../warehouses/warehouse.repository";
import { productRepository } from "../products/product.repository";
import { combinationRepository } from "../combinations/combination.repository";
import {
  CreateInventoryDto,
  UpdateInventoryDto,
  TransferInventoryDto,
} from "./inventory.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger, auditLogger } from "../../shared/logger";

const LOW_STOCK_THRESHOLD = 10;

export const inventoryService = {
  getAll: async (query: {
    category?: string;
    location?: string;
    warehouse_id?: string;
    page?: string;
    limit?: string;
  }) => {
    const [items, total] = await inventoryRepository.findAll(query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getProductLines: async (
    productId: number,
    query: { page?: string; limit?: string },
  ) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    const [items, total] = await inventoryRepository.findLinesByProduct(
      productId,
      query,
    );
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getById: async (id: string) => {
    const item = await inventoryRepository.findById(id);
    if (!item) throw new AppError("Inventory item not found", 404);
    return item;
  },

  search: async (keyword: string, query: { page?: string; limit?: string }) => {
    const [items, total] = await inventoryRepository.search(keyword, query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getGrouped: async (query: {
    category?: string;
    warehouse_id?: string;
    low_stock?: string;
    out_of_stock?: string;
    page?: string;
    limit?: string;
  }) => {
    const { items, total } =
      await inventoryRepository.findGroupedByProduct(query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  create: async (dto: CreateInventoryDto) => {
    const product = await productRepository.findById(dto.product_id, true);
    if (!product) throw new AppError("Product not found", 404);

    const warehouse = await warehouseRepository.findById(dto.warehouse_id);
    if (!warehouse) throw new AppError("Warehouse not found", 404);

    const combinations = await combinationRepository.findByProduct(
      dto.product_id,
    );
    const hasActiveCombinations = combinations.some((c) => c.isActive);

    if (dto.combination_id) {
      const combination = combinations.find((c) => c.id === dto.combination_id);
      if (!combination)
        throw new AppError("Combination not found on this product", 404);
      if (!combination.isActive)
        throw new AppError("Cannot add stock to an inactive combination", 400);
    } else if (hasActiveCombinations) {
      throw new AppError(
        "This product has active combinations — stock must be attached to a specific combination, not to the product directly",
        400,
      );
    }

    const existing = await inventoryRepository.findByProductAndWarehouse(
      dto.product_id,
      dto.warehouse_id,
      dto.combination_id,
    );
    if (existing)
      throw new AppError(
        "Inventory item already exists for this product, warehouse and combination",
        409,
      );

    const item = await inventoryRepository.create(dto);

    businessLogger.log("STOCK_ADDED", {
      service: "inventory",
      actor: { userId: null, role: "ADMIN" },
      target: {
        inventoryId: item.id,
        productId: dto.product_id,
        warehouseId: dto.warehouse_id,
      },
      metadata: {
        quantity: dto.quantity,
        combinationId: dto.combination_id ?? null,
      },
    });

    auditLogger.log("STOCK_ADDED", {
      service: "inventory",
      actor: { userId: null, role: "ADMIN" },
      target: { inventoryId: item.id, productId: dto.product_id },
      metadata: {
        quantity: dto.quantity,
        warehouseId: dto.warehouse_id,
        combinationId: dto.combination_id ?? null,
      },
    });

    return item;
  },

  update: async (id: string, dto: UpdateInventoryDto) => {
    const item = await inventoryRepository.findById(id);
    if (!item) throw new AppError("Inventory item not found", 404);

    if (dto.warehouse_id && dto.warehouse_id !== item.warehouseId) {
      const warehouse = await warehouseRepository.findById(dto.warehouse_id);
      if (!warehouse) throw new AppError("Warehouse not found", 404);

      const existing = await inventoryRepository.findByProductAndWarehouse(
        item.productId,
        dto.warehouse_id,
        item.combinationId ?? undefined,
      );
      if (existing)
        throw new AppError(
          "Inventory item already exists for this product, warehouse and combination",
          409,
        );
    }

    const updated = await inventoryRepository.update(id, dto);

    businessLogger.log("STOCK_ADJUSTED", {
      service: "inventory",
      actor: { userId: null, role: "ADMIN" },
      target: { inventoryId: id, productId: item.productId },
      metadata: { oldQuantity: item.quantity, newQuantity: dto.quantity },
    });

    auditLogger.log("STOCK_ADJUSTED", {
      service: "inventory",
      actor: { userId: null, role: "ADMIN" },
      target: { inventoryId: id },
      metadata: { oldQuantity: item.quantity, newQuantity: dto.quantity },
    });

    if (dto.quantity !== undefined) {
      if (dto.quantity === 0) {
        businessLogger.log("OUT_OF_STOCK", {
          service: "inventory",
          actor: { userId: null, role: "SYSTEM" },
          target: { inventoryId: id, productId: item.productId },
        });
      } else if (dto.quantity <= LOW_STOCK_THRESHOLD) {
        businessLogger.log("LOW_STOCK", {
          service: "inventory",
          actor: { userId: null, role: "SYSTEM" },
          target: { inventoryId: id, productId: item.productId },
          metadata: { quantity: dto.quantity, threshold: LOW_STOCK_THRESHOLD },
        });
      }
    }

    return updated;
  },

  delete: async (id: string) => {
    const item = await inventoryRepository.findById(id);
    if (!item) throw new AppError("Inventory item not found", 404);

    await inventoryRepository.delete(id);

    businessLogger.log("STOCK_REMOVED", {
      service: "inventory",
      actor: { userId: null, role: "ADMIN" },
      target: { inventoryId: id, productId: item.productId },
    });

    auditLogger.log("STOCK_REMOVED", {
      service: "inventory",
      actor: { userId: null, role: "ADMIN" },
      target: { inventoryId: id },
      metadata: { productId: item.productId, warehouseId: item.warehouseId },
    });

    return { message: "Inventory item deleted successfully" };
  },

  transfer: async (dto: TransferInventoryDto) => {
    const itemById = await inventoryRepository.findById(dto.item_id);
    if (!itemById) throw new AppError("Inventory item not found", 404);

    const source = await inventoryRepository.findByProductAndWarehouse(
      itemById.productId,
      dto.from_warehouse,
      itemById.combinationId ?? undefined,
    );
    if (!source) throw new AppError("Source inventory not found", 404);
    if (source.quantity < dto.quantity)
      throw new AppError("Insufficient stock in source warehouse", 400);

    const destination = await inventoryRepository.findByProductAndWarehouse(
      source.productId,
      dto.to_warehouse,
      source.combinationId ?? undefined,
    );

    await inventoryRepository.decrementQuantity(source.id, dto.quantity);

    if (destination) {
      await inventoryRepository.incrementQuantity(destination.id, dto.quantity);
    } else {
      await inventoryRepository.create({
        product_id: source.productId,
        warehouse_id: dto.to_warehouse,
        combination_id: source.combinationId ?? undefined,
        quantity: dto.quantity,
      });
    }

    businessLogger.log("STOCK_TRANSFERRED", {
      service: "inventory",
      actor: { userId: null, role: "ADMIN" },
      target: { inventoryId: dto.item_id, productId: source.productId },
      metadata: {
        fromWarehouse: dto.from_warehouse,
        toWarehouse: dto.to_warehouse,
        quantity: dto.quantity,
        combinationId: source.combinationId ?? null,
      },
    });

    auditLogger.log("STOCK_TRANSFERRED", {
      service: "inventory",
      actor: { userId: null, role: "ADMIN" },
      target: { inventoryId: dto.item_id },
      metadata: {
        fromWarehouse: dto.from_warehouse,
        toWarehouse: dto.to_warehouse,
        quantity: dto.quantity,
        combinationId: source.combinationId ?? null,
      },
    });

    return {
      item_id: dto.item_id,
      from_warehouse: dto.from_warehouse,
      to_warehouse: dto.to_warehouse,
      combination_id: source.combinationId ?? null,
      quantity: dto.quantity,
    };
  },
};
