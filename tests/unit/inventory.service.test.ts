import { inventoryService } from "../../src/modules/inventory/inventory.service";
import { inventoryRepository } from "../../src/modules/inventory/inventory.repository";
import { warehouseRepository } from "../../src/modules/warehouses/warehouse.repository";
import { productRepository } from "../../src/modules/products/product.repository";
import { AppError } from "../../src/shared/utils/app-error";
import {
  makeProduct,
  makeWarehouse,
  makeInventoryItem,
} from "../mocks/factories";

jest.mock("../../src/modules/inventory/inventory.repository");
jest.mock("../../src/modules/warehouses/warehouse.repository");
jest.mock("../../src/modules/products/product.repository");

const mockedInvRepo = inventoryRepository as jest.Mocked<
  typeof inventoryRepository
>;
const mockedWarehouseRepo = warehouseRepository as jest.Mocked<
  typeof warehouseRepository
>;
const mockedProductRepo = productRepository as jest.Mocked<
  typeof productRepository
>;

describe("inventoryService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = { product_id: 1, warehouse_id: "wh_1", quantity: 50 };

  it("rejette si le produit est introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(null);

    await expect(inventoryService.create(dto as any)).rejects.toThrow(
      "Product not found",
    );
  });

  it("rejette si l'entrepôt est introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedWarehouseRepo.findById.mockResolvedValue(null);

    await expect(inventoryService.create(dto as any)).rejects.toThrow(
      "Warehouse not found",
    );
  });

  it("rejette si une entrée existe déjà pour ce produit/entrepôt", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedWarehouseRepo.findById.mockResolvedValue(makeWarehouse() as any);
    mockedInvRepo.findByProductAndWarehouse.mockResolvedValue(
      makeInventoryItem() as any,
    );

    await expect(inventoryService.create(dto as any)).rejects.toThrow(AppError);
  });

  it("crée une entrée de stock", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedWarehouseRepo.findById.mockResolvedValue(makeWarehouse() as any);
    mockedInvRepo.findByProductAndWarehouse.mockResolvedValue(null);
    mockedInvRepo.create.mockResolvedValue(makeInventoryItem() as any);

    const result = await inventoryService.create(dto as any);

    expect(result.id).toBe("inv_1");
    expect(mockedInvRepo.create).toHaveBeenCalledWith(dto);
  });
});

describe("inventoryService.update", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si l'item est introuvable", async () => {
    mockedInvRepo.findById.mockResolvedValue(null);

    await expect(
      inventoryService.update("inv_99", { quantity: 10 } as any),
    ).rejects.toThrow(AppError);
  });

  it("met à jour la quantité sans alerte si > seuil", async () => {
    mockedInvRepo.findById.mockResolvedValue(
      makeInventoryItem({ quantity: 50 }) as any,
    );
    mockedInvRepo.update.mockResolvedValue(
      makeInventoryItem({ quantity: 30 }) as any,
    );

    const { businessLogger } = await import("../../src/shared/logger");
    const result = await inventoryService.update("inv_1", {
      quantity: 30,
    } as any);

    expect(result.quantity).toBe(30);
    expect(businessLogger.log).not.toHaveBeenCalledWith(
      "LOW_STOCK",
      expect.anything(),
    );
    expect(businessLogger.log).not.toHaveBeenCalledWith(
      "OUT_OF_STOCK",
      expect.anything(),
    );
  });

  it("logge LOW_STOCK si la quantité passe sous le seuil", async () => {
    mockedInvRepo.findById.mockResolvedValue(
      makeInventoryItem({ quantity: 50 }) as any,
    );
    mockedInvRepo.update.mockResolvedValue(
      makeInventoryItem({ quantity: 5 }) as any,
    );

    const { businessLogger } = await import("../../src/shared/logger");
    await inventoryService.update("inv_1", { quantity: 5 } as any);

    expect(businessLogger.log).toHaveBeenCalledWith(
      "LOW_STOCK",
      expect.objectContaining({
        metadata: expect.objectContaining({ quantity: 5, threshold: 10 }),
      }),
    );
  });

  it("logge OUT_OF_STOCK si la quantité tombe à 0", async () => {
    mockedInvRepo.findById.mockResolvedValue(
      makeInventoryItem({ quantity: 5 }) as any,
    );
    mockedInvRepo.update.mockResolvedValue(
      makeInventoryItem({ quantity: 0 }) as any,
    );

    const { businessLogger } = await import("../../src/shared/logger");
    await inventoryService.update("inv_1", { quantity: 0 } as any);

    expect(businessLogger.log).toHaveBeenCalledWith(
      "OUT_OF_STOCK",
      expect.objectContaining({
        target: expect.objectContaining({ inventoryId: "inv_1" }),
      }),
    );
  });
});

describe("inventoryService.delete", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedInvRepo.findById.mockResolvedValue(null);
    await expect(inventoryService.delete("inv_99")).rejects.toThrow(AppError);
  });

  it("supprime avec succès", async () => {
    mockedInvRepo.findById.mockResolvedValue(makeInventoryItem() as any);

    const result = await inventoryService.delete("inv_1");

    expect(result.message).toBe("Inventory item deleted successfully");
    expect(mockedInvRepo.delete).toHaveBeenCalledWith("inv_1");
  });
});

describe("inventoryService.transfer", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = {
    item_id: "inv_1",
    from_warehouse: "wh_1",
    to_warehouse: "wh_2",
    quantity: 10,
  };

  it("rejette si le stock source est introuvable", async () => {
    mockedInvRepo.findById.mockResolvedValue(
      makeInventoryItem({ productId: 1 }) as any,
    );
    mockedInvRepo.findByProductAndWarehouse.mockResolvedValueOnce(null);

    await expect(inventoryService.transfer(dto as any)).rejects.toThrow(
      "Source inventory not found",
    );
  });

  it("rejette si le stock source est insuffisant", async () => {
    mockedInvRepo.findById.mockResolvedValue(
      makeInventoryItem({ productId: 1 }) as any,
    );
    mockedInvRepo.findByProductAndWarehouse.mockResolvedValueOnce(
      makeInventoryItem({ id: "inv_src", quantity: 5 }) as any,
    );

    await expect(inventoryService.transfer(dto as any)).rejects.toThrow(
      "Insufficient stock in source warehouse",
    );
  });

  it("transfère le stock vers un entrepôt destination existant", async () => {
    mockedInvRepo.findById.mockResolvedValue(
      makeInventoryItem({ productId: 1 }) as any,
    );
    mockedInvRepo.findByProductAndWarehouse
      .mockResolvedValueOnce(
        makeInventoryItem({ id: "inv_src", quantity: 20, productId: 1 }) as any,
      )
      .mockResolvedValueOnce(
        makeInventoryItem({
          id: "inv_dst",
          quantity: 5,
          warehouseId: "wh_2",
          productId: 1,
        }) as any,
      );

    const result = await inventoryService.transfer(dto as any);

    expect(mockedInvRepo.decrementQuantity).toHaveBeenCalledWith("inv_src", 10);
    expect(mockedInvRepo.incrementQuantity).toHaveBeenCalledWith("inv_dst", 10);
    expect(mockedInvRepo.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      item_id: "inv_1",
      from_warehouse: "wh_1",
      to_warehouse: "wh_2",
      quantity: 10,
    });
  });

  it("crée une entrée d'inventaire si la destination n'existe pas encore", async () => {
    mockedInvRepo.findById.mockResolvedValue(
      makeInventoryItem({ productId: 1 }) as any,
    );
    mockedInvRepo.findByProductAndWarehouse
      .mockResolvedValueOnce(
        makeInventoryItem({ id: "inv_src", quantity: 20, productId: 1 }) as any,
      )
      .mockResolvedValueOnce(null);

    await inventoryService.transfer(dto as any);

    expect(mockedInvRepo.decrementQuantity).toHaveBeenCalledWith("inv_src", 10);
    expect(mockedInvRepo.incrementQuantity).not.toHaveBeenCalled();
    expect(mockedInvRepo.create).toHaveBeenCalledWith({
      product_id: 1,
      warehouse_id: "wh_2",
      quantity: 10,
    });
  });
});
