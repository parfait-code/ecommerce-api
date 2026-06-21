import { promotionService } from "../../src/modules/promotions/promotion.service";
import { promotionRepository } from "../../src/modules/promotions/promotion.repository";
import { AppError } from "../../src/shared/utils/app-error";
import { makeCoupon } from "../mocks/factories";

jest.mock("../../src/modules/promotions/promotion.repository");

const mockedRepo = promotionRepository as jest.Mocked<
  typeof promotionRepository
>;

describe("promotionService.validateCoupon", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = { code: "PROMO10", basketId: "basket_1" };

  it("rejette un code inexistant", async () => {
    mockedRepo.findCouponByCode.mockResolvedValue(null);

    await expect(promotionService.validateCoupon(dto, 1)).rejects.toThrow(
      "Invalid coupon code",
    );
  });

  it("rejette un coupon inactif", async () => {
    mockedRepo.findCouponByCode.mockResolvedValue(
      makeCoupon({ isActive: false }) as any,
    );

    await expect(promotionService.validateCoupon(dto, 1)).rejects.toThrow(
      "This coupon is not active",
    );
  });

  it("rejette si la promotion liée est inactive", async () => {
    mockedRepo.findCouponByCode.mockResolvedValue(
      makeCoupon({
        promotion: { id: "promo_1", isActive: false, discounts: [] },
      }) as any,
    );

    await expect(promotionService.validateCoupon(dto, 1)).rejects.toThrow(
      "promotion linked to this coupon is not active",
    );
  });

  it("rejette si le coupon n'est pas encore valide", async () => {
    const future = new Date(Date.now() + 86400000);
    mockedRepo.findCouponByCode.mockResolvedValue(
      makeCoupon({ startDate: future }) as any,
    );

    await expect(promotionService.validateCoupon(dto, 1)).rejects.toThrow(
      "not yet valid",
    );
  });

  it("rejette si le coupon a expiré", async () => {
    const past = new Date(Date.now() - 86400000);
    mockedRepo.findCouponByCode.mockResolvedValue(
      makeCoupon({ endDate: past }) as any,
    );

    await expect(promotionService.validateCoupon(dto, 1)).rejects.toThrow(
      "has expired",
    );
  });

  it("rejette si le plafond global d'utilisation est atteint", async () => {
    mockedRepo.findCouponByCode.mockResolvedValue(
      makeCoupon({ maxUses: 10, usedCount: 10 }) as any,
    );

    await expect(promotionService.validateCoupon(dto, 1)).rejects.toThrow(
      "maximum usage limit",
    );
  });

  it("rejette si l'utilisateur a déjà atteint sa limite personnelle", async () => {
    mockedRepo.findCouponByCode.mockResolvedValue(
      makeCoupon({ perUserLimit: 1, uses: [{ userId: 1 }] }) as any,
    );

    await expect(promotionService.validateCoupon(dto, 1)).rejects.toThrow(
      "maximum number of times",
    );
  });

  it("n'est pas bloqué par l'usage d'un AUTRE utilisateur", async () => {
    mockedRepo.findCouponByCode.mockResolvedValue(
      makeCoupon({ perUserLimit: 1, uses: [{ userId: 99 }] }) as any,
    );

    const result = await promotionService.validateCoupon(dto, 1);
    expect(result.valid).toBe(true);
  });

  it("valide un coupon correct et retourne les détails de la promotion", async () => {
    const coupon = makeCoupon({
      id: "coupon_1",
      code: "PROMO10",
      promotion: {
        id: "promo_1",
        isActive: true,
        name: "Promo Été",
        slug: "promo-ete",
        discounts: [{ id: "disc_1", type: "PERCENTAGE", value: 10 }],
      },
    });
    mockedRepo.findCouponByCode.mockResolvedValue(coupon as any);

    const result = await promotionService.validateCoupon(dto, 1);

    expect(result).toEqual({
      valid: true,
      couponId: "coupon_1",
      code: "PROMO10",
      promotion: { id: "promo_1", name: "Promo Été", slug: "promo-ete" },
      discounts: coupon.promotion.discounts,
    });
  });
});
