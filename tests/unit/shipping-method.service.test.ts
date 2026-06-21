// tests/unit/shipping-method.service.test.ts
import { shippingMethodService } from "../../src/modules/shipping-methods/shipping-method.service";
import { shippingMethodRepository } from "../../src/modules/shipping-methods/shipping-method.repository";
import { AppError } from "../../src/shared/utils/app-error";

jest.mock("../../src/modules/shipping-methods/shipping-method.repository");

const mockedRepo = shippingMethodRepository as jest.Mocked<
  typeof shippingMethodRepository
>;

const makeShippingMethod = (overrides: Partial<any> = {}) => ({
  id: "sm_1",
  name: "Livraison standard",
  basePrice: 1000,
  pricePerKg: 100,
  estimatedDays: 3,
  isActive: true,
  zones: ["CM"],
  ...overrides,
});

describe("shippingMethodService.getById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(shippingMethodService.getById("sm_99")).rejects.toThrow(
      AppError,
    );
  });
});

describe("shippingMethodService.calculate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si la méthode est introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(
      shippingMethodService.calculate({ shippingMethodId: "sm_99", weight: 2 }),
    ).rejects.toThrow("Shipping method not found");
  });

  it("rejette si la méthode est inactive", async () => {
    mockedRepo.findById.mockResolvedValue(
      makeShippingMethod({ isActive: false }) as any,
    );
    await expect(
      shippingMethodService.calculate({ shippingMethodId: "sm_1", weight: 2 }),
    ).rejects.toThrow("not available");
  });

  it("calcule le coût correctement (basePrice + pricePerKg × weight)", async () => {
    mockedRepo.findById.mockResolvedValue(makeShippingMethod() as any);

    const result = await shippingMethodService.calculate({
      shippingMethodId: "sm_1",
      weight: 2,
    });

    // 1000 + 100 * 2 = 1200
    expect(result.cost).toBe(1200);
    expect(result.currency).toBe("XAF");
    expect(result.estimatedDays).toBe(3);
  });
});

describe("shippingMethodService.delete", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(shippingMethodService.delete("sm_99")).rejects.toThrow(
      AppError,
    );
  });

  it("supprime avec succès", async () => {
    mockedRepo.findById.mockResolvedValue(makeShippingMethod() as any);
    const result = await shippingMethodService.delete("sm_1");
    expect(result.message).toBe("Shipping method deleted successfully");
  });
});
