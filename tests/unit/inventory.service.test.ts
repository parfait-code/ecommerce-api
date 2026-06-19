import { inventoryService } from "../../src/modules/inventory/inventory.service";
import { inventoryRepository } from "../../src/modules/inventory/inventory.repository";
import { warehouseRepository } from "../../src/modules/warehouses/warehouse.repository";
import { productRepository } from "../../src/modules/products/product.repository";
import { AppError } from "../../src/shared/utils/app-error";

jest.mock("../../src/modules/inventory/inventory.repository");
jest.mock("../../src/modules/warehouses/warehouse.repository");
jest.mock("../../src/modules/products/product.repository");

const mockInventoryRepository = inventoryRepository as jest.Mocked<
  typeof inventoryRepository
>;
const mockWarehouseRepository = warehouseRepository as jest.Mocked<
  typeof warehouseRepository
>;
const mockProductRepository = productRepository as jest.Mocked<
  typeof productRepository
>;

const mockCategory = {
  id: "cat-cuid-1",
  name: "Electronics",
  slug: "electronics",
};

const mockProduct = {
  id: 1,
  name: "Test Product",
  description: null,
  price: 99.99,
  categoryId: "cat-cuid-1",
  category: mockCategory,
  stock: 10,
  images: [] as string[],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockWarehouse = {
  id: "warehouse-cuid-1",
  name: "Main Warehouse",
  location: "Yaoundé, CM",
  capacity: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInventoryItem = {
  id: "inventory-cuid-1",
  productId: 1,
  warehouseId: "warehouse-cuid-1",
  quantity: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
  product: mockProduct,
  warehouse: mockWarehouse,
};

describe("InventoryService", () => {
  describe("getAll", () => {
    it("should return all inventory items", async () => {
      mockInventoryRepository.findAll.mockResolvedValue([mockInventoryItem]);

      const result = await inventoryService.getAll({});

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockInventoryItem);
    });

    it("should filter by category", async () => {
      mockInventoryRepository.findAll.mockResolvedValue([mockInventoryItem]);

      await inventoryService.getAll({ category: "Electronics" });

      expect(mockInventoryRepository.findAll).toHaveBeenCalledWith({
        category: "Electronics",
      });
    });

    it("should filter by location", async () => {
      mockInventoryRepository.findAll.mockResolvedValue([mockInventoryItem]);

      await inventoryService.getAll({ location: "Yaoundé" });

      expect(mockInventoryRepository.findAll).toHaveBeenCalledWith({
        location: "Yaoundé",
      });
    });
  });

  describe("getById", () => {
    it("should return inventory item if found", async () => {
      mockInventoryRepository.findById.mockResolvedValue(mockInventoryItem);

      const result = await inventoryService.getById("inventory-cuid-1");

      expect(result).toEqual(mockInventoryItem);
    });

    it("should throw 404 if inventory item not found", async () => {
      mockInventoryRepository.findById.mockResolvedValue(null);

      await expect(inventoryService.getById("nonexistent")).rejects.toThrow(
        new AppError("Inventory item not found", 404),
      );
    });
  });

  describe("getLowStock", () => {
    it("should return items below threshold", async () => {
      mockInventoryRepository.findLowStock.mockResolvedValue([
        mockInventoryItem,
      ]);

      const result = await inventoryService.getLowStock(100);

      expect(mockInventoryRepository.findLowStock).toHaveBeenCalledWith(100);
      expect(result).toHaveLength(1);
    });
  });

  describe("getOutOfStock", () => {
    it("should return out of stock items", async () => {
      const outOfStock = { ...mockInventoryItem, quantity: 0 };
      mockInventoryRepository.findOutOfStock.mockResolvedValue([outOfStock]);

      const result = await inventoryService.getOutOfStock();

      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(0);
    });
  });

  describe("search", () => {
    it("should return items matching keyword", async () => {
      mockInventoryRepository.search.mockResolvedValue([mockInventoryItem]);

      const result = await inventoryService.search("Test");

      expect(mockInventoryRepository.search).toHaveBeenCalledWith("Test");
      expect(result).toHaveLength(1);
    });
  });

  describe("create", () => {
    it("should create an inventory item", async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockInventoryRepository.findByProductAndWarehouse.mockResolvedValue(null);
      mockInventoryRepository.create.mockResolvedValue(mockInventoryItem);

      const result = await inventoryService.create({
        product_id: 1,
        warehouse_id: "warehouse-cuid-1",
        quantity: 50,
      });

      expect(result).toEqual(mockInventoryItem);
    });

    it("should throw 404 if product not found", async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(
        inventoryService.create({
          product_id: 999,
          warehouse_id: "warehouse-cuid-1",
          quantity: 10,
        }),
      ).rejects.toThrow(new AppError("Product not found", 404));
    });

    it("should throw 404 if warehouse not found", async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockWarehouseRepository.findById.mockResolvedValue(null);

      await expect(
        inventoryService.create({
          product_id: 1,
          warehouse_id: "nonexistent",
          quantity: 10,
        }),
      ).rejects.toThrow(new AppError("Warehouse not found", 404));
    });

    it("should throw 409 if inventory item already exists", async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse);
      mockInventoryRepository.findByProductAndWarehouse.mockResolvedValue(
        mockInventoryItem,
      );

      await expect(
        inventoryService.create({
          product_id: 1,
          warehouse_id: "warehouse-cuid-1",
          quantity: 10,
        }),
      ).rejects.toThrow(
        new AppError(
          "Inventory item already exists for this product and warehouse",
          409,
        ),
      );
    });
  });

  describe("update", () => {
    it("should update inventory item", async () => {
      const updated = { ...mockInventoryItem, quantity: 100 };
      mockInventoryRepository.findById.mockResolvedValue(mockInventoryItem);
      mockInventoryRepository.update.mockResolvedValue(updated);

      const result = await inventoryService.update("inventory-cuid-1", {
        quantity: 100,
      });

      expect(result.quantity).toBe(100);
    });

    it("should throw 404 if inventory item not found", async () => {
      mockInventoryRepository.findById.mockResolvedValue(null);

      await expect(
        inventoryService.update("nonexistent", { quantity: 10 }),
      ).rejects.toThrow(new AppError("Inventory item not found", 404));
    });
  });

  describe("delete", () => {
    it("should delete inventory item and return message", async () => {
      mockInventoryRepository.findById.mockResolvedValue(mockInventoryItem);
      mockInventoryRepository.delete.mockResolvedValue(mockInventoryItem);

      const result = await inventoryService.delete("inventory-cuid-1");

      expect(mockInventoryRepository.delete).toHaveBeenCalledWith(
        "inventory-cuid-1",
      );
      expect(result).toEqual({
        message: "Inventory item deleted successfully",
      });
    });

    it("should throw 404 if inventory item not found", async () => {
      mockInventoryRepository.findById.mockResolvedValue(null);

      await expect(inventoryService.delete("nonexistent")).rejects.toThrow(
        new AppError("Inventory item not found", 404),
      );
    });
  });

  describe("transfer", () => {
    const mockDestinationWarehouse = {
      ...mockWarehouse,
      id: "warehouse-cuid-2",
      name: "Secondary Warehouse",
    };

    it("should transfer stock between warehouses (destination exists)", async () => {
      const sourceItem = { ...mockInventoryItem, quantity: 100 };
      const destinationItem = {
        ...mockInventoryItem,
        id: "inventory-cuid-2",
        warehouseId: "warehouse-cuid-2",
        quantity: 20,
      };

      mockInventoryRepository.findById.mockResolvedValue(sourceItem);
      mockInventoryRepository.findByProductAndWarehouse
        .mockResolvedValueOnce(sourceItem) // source lookup
        .mockResolvedValueOnce(destinationItem); // destination lookup

      mockInventoryRepository.decrementQuantity.mockResolvedValue({
        ...sourceItem,
        quantity: 70,
      });
      mockInventoryRepository.incrementQuantity.mockResolvedValue({
        ...destinationItem,
        quantity: 50,
      });

      const result = await inventoryService.transfer({
        item_id: "inventory-cuid-1",
        from_warehouse: "warehouse-cuid-1",
        to_warehouse: "warehouse-cuid-2",
        quantity: 30,
      });

      expect(mockInventoryRepository.decrementQuantity).toHaveBeenCalledWith(
        "inventory-cuid-1",
        30,
      );
      expect(mockInventoryRepository.incrementQuantity).toHaveBeenCalledWith(
        "inventory-cuid-2",
        30,
      );
      expect(result).toEqual({
        item_id: "inventory-cuid-1",
        from_warehouse: "warehouse-cuid-1",
        to_warehouse: "warehouse-cuid-2",
        quantity: 30,
      });
    });

    it("should create destination inventory if it does not exist", async () => {
      const sourceItem = { ...mockInventoryItem, quantity: 100 };

      mockInventoryRepository.findById.mockResolvedValue(sourceItem);
      mockInventoryRepository.findByProductAndWarehouse
        .mockResolvedValueOnce(sourceItem) // source lookup
        .mockResolvedValueOnce(null); // destination does not exist

      mockInventoryRepository.decrementQuantity.mockResolvedValue({
        ...sourceItem,
        quantity: 70,
      });
      mockInventoryRepository.create.mockResolvedValue({
        ...mockInventoryItem,
        id: "inventory-cuid-new",
        warehouseId: "warehouse-cuid-2",
        quantity: 30,
        warehouse: mockDestinationWarehouse,
      });

      await inventoryService.transfer({
        item_id: "inventory-cuid-1",
        from_warehouse: "warehouse-cuid-1",
        to_warehouse: "warehouse-cuid-2",
        quantity: 30,
      });

      expect(mockInventoryRepository.create).toHaveBeenCalledWith({
        product_id: 1,
        warehouse_id: "warehouse-cuid-2",
        quantity: 30,
      });
    });

    it("should throw 404 if source inventory not found", async () => {
      mockInventoryRepository.findById.mockResolvedValue(mockInventoryItem);
      mockInventoryRepository.findByProductAndWarehouse.mockResolvedValue(null);

      await expect(
        inventoryService.transfer({
          item_id: "inventory-cuid-1",
          from_warehouse: "warehouse-cuid-1",
          to_warehouse: "warehouse-cuid-2",
          quantity: 10,
        }),
      ).rejects.toThrow(new AppError("Source inventory not found", 404));
    });

    it("should throw 400 if insufficient stock", async () => {
      const sourceItem = { ...mockInventoryItem, quantity: 5 };

      mockInventoryRepository.findById.mockResolvedValue(sourceItem);
      mockInventoryRepository.findByProductAndWarehouse.mockResolvedValue(
        sourceItem,
      );

      await expect(
        inventoryService.transfer({
          item_id: "inventory-cuid-1",
          from_warehouse: "warehouse-cuid-1",
          to_warehouse: "warehouse-cuid-2",
          quantity: 50, // more than available (5)
        }),
      ).rejects.toThrow(
        new AppError("Insufficient stock in source warehouse", 400),
      );
    });
  });
});
