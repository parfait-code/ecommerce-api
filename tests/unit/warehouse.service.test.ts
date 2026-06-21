// tests/unit/warehouse.service.test.ts
import { warehouseService } from "../../src/modules/warehouses/warehouse.service";
import { warehouseRepository } from "../../src/modules/warehouses/warehouse.repository";
import { AppError } from "../../src/shared/utils/app-error";

jest.mock("../../src/modules/warehouses/warehouse.repository");
jest.mock("../../src/shared/config/database", () => ({
  prisma: {
    inventory: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock("../../src/shared/utils/cache", () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));
jest.mock("../../src/shared/logger", () => ({
  businessLogger: { log: jest.fn() },
}));

import { cache } from "../../src/shared/utils/cache";
import { prisma } from "../../src/shared/config/database";

const mockedRepo = warehouseRepository as jest.Mocked<
  typeof warehouseRepository
>;
const mockedCacheGet = cache.get as jest.Mock;
const mockedCacheSet = cache.set as jest.Mock;
const mockedCacheDel = cache.del as jest.Mock;
const mockedPrismaInventory = prisma.inventory.findMany as jest.Mock;

const makeWarehouse = (overrides: Partial<any> = {}) => ({
  id: "wh_1",
  name: "Entrepôt Douala",
  location: "Douala",
  capacity: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("warehouseService.getAll", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retourne le cache si présent", async () => {
    mockedCacheGet.mockResolvedValue([makeWarehouse()]);

    const result = await warehouseService.getAll();

    expect(result).toHaveLength(1);
    expect(mockedRepo.findAll).not.toHaveBeenCalled();
  });

  it("interroge le repository et met en cache si absent", async () => {
    mockedCacheGet.mockResolvedValue(null);
    mockedRepo.findAll.mockResolvedValue([makeWarehouse()]);

    const result = await warehouseService.getAll();

    expect(result).toHaveLength(1);
    expect(mockedCacheSet).toHaveBeenCalledWith(
      "warehouses:all",
      expect.any(Array),
    );
  });
});

describe("warehouseService.getById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retourne le cache si présent", async () => {
    mockedCacheGet.mockResolvedValue(makeWarehouse());

    const result = (await warehouseService.getById("wh_1")) as ReturnType<
      typeof makeWarehouse
    >;

    expect(result.id).toBe("wh_1");
    expect(mockedRepo.findById).not.toHaveBeenCalled();
  });

  it("rejette si introuvable", async () => {
    mockedCacheGet.mockResolvedValue(null);
    mockedRepo.findById.mockResolvedValue(null);

    await expect(warehouseService.getById("wh_99")).rejects.toThrow(
      "Warehouse not found",
    );
  });

  it("retourne et met en cache si absent du cache", async () => {
    mockedCacheGet.mockResolvedValue(null);
    mockedRepo.findById.mockResolvedValue(makeWarehouse());

    const result = (await warehouseService.getById("wh_1")) as ReturnType<
      typeof makeWarehouse
    >;

    expect(result.id).toBe("wh_1");
    expect(mockedCacheSet).toHaveBeenCalledWith(
      "warehouses:wh_1",
      expect.any(Object),
    );
  });
});

describe("warehouseService.getInventory", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si l'entrepôt est introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);

    await expect(warehouseService.getInventory("wh_99")).rejects.toThrow(
      "Warehouse not found",
    );
  });

  it("retourne l'entrepôt avec ses items et le total des unités", async () => {
    mockedRepo.findById.mockResolvedValue(makeWarehouse());
    mockedPrismaInventory.mockResolvedValue([
      {
        id: "inv_1",
        quantity: 30,
        product: { id: 1, name: "Prod A", category: {}, price: 1000 },
      },
      {
        id: "inv_2",
        quantity: 20,
        product: { id: 2, name: "Prod B", category: {}, price: 2000 },
      },
    ]);

    const result = await warehouseService.getInventory("wh_1");

    expect(result.warehouse.totalUnits).toBe(50);
    expect(result.items).toHaveLength(2);
  });

  it("retourne totalUnits = 0 si aucun item", async () => {
    mockedRepo.findById.mockResolvedValue(makeWarehouse());
    mockedPrismaInventory.mockResolvedValue([]);

    const result = await warehouseService.getInventory("wh_1");

    expect(result.warehouse.totalUnits).toBe(0);
    expect(result.items).toHaveLength(0);
  });
});

describe("warehouseService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crée l'entrepôt et invalide le cache liste", async () => {
    mockedRepo.create.mockResolvedValue(makeWarehouse());

    const result = await warehouseService.create({
      name: "Entrepôt Douala",
      location: "Douala",
    });

    expect(result.id).toBe("wh_1");
    expect(mockedCacheDel).toHaveBeenCalledWith("warehouses:all");
  });
});

describe("warehouseService.update", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si l'entrepôt est introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);

    await expect(
      warehouseService.update("wh_99", { name: "Nouveau" }),
    ).rejects.toThrow("Warehouse not found");
  });

  it("met à jour et invalide les caches single et liste", async () => {
    mockedRepo.findById.mockResolvedValue(makeWarehouse());
    mockedRepo.update.mockResolvedValue(makeWarehouse({ name: "Nouveau" }));

    const result = await warehouseService.update("wh_1", { name: "Nouveau" });

    expect(result.name).toBe("Nouveau");
    expect(mockedCacheDel).toHaveBeenCalledWith(
      "warehouses:wh_1",
      "warehouses:all",
    );
  });
});

describe("warehouseService.delete", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si l'entrepôt est introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);

    await expect(warehouseService.delete("wh_99")).rejects.toThrow(
      "Warehouse not found",
    );
  });

  it("supprime et invalide les caches", async () => {
    mockedRepo.findById.mockResolvedValue(makeWarehouse());
    mockedRepo.delete.mockResolvedValue(makeWarehouse());

    const result = await warehouseService.delete("wh_1");

    expect(result.message).toBe("Warehouse deleted successfully");
    expect(mockedCacheDel).toHaveBeenCalledWith(
      "warehouses:wh_1",
      "warehouses:all",
    );
  });
});
