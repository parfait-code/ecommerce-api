import { orderService } from "../../src/modules/orders/order.service";
import { orderRepository } from "../../src/modules/orders/order.repository";
import { productRepository } from "../../src/modules/products/product.repository";
import { promotionRepository } from "../../src/modules/promotions/promotion.repository";
import { loyaltyService } from "../../src/modules/loyalty/loyalty.service";
import { AppError } from "../../src/shared/utils/app-error";
import { makeProduct, makeOrder, makeCoupon } from "../mocks/factories";

jest.mock("@/modules/orders/order.repository");
jest.mock("@/modules/products/product.repository");
jest.mock("@/modules/promotions/promotion.repository");
jest.mock("@/modules/loyalty/loyalty.service");
jest.mock("@/shared/utils/cache", () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delByPattern: jest.fn(),
  },
}));
jest.mock("@/shared/logger", () => ({
  businessLogger: { log: jest.fn() },
  auditLogger: { log: jest.fn() },
}));

const mockedOrderRepo = orderRepository as jest.Mocked<typeof orderRepository>;
const mockedProductRepo = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedPromoRepo = promotionRepository as jest.Mocked<
  typeof promotionRepository
>;
const mockedLoyalty = loyaltyService as jest.Mocked<typeof loyaltyService>;

const baseDto = {
  items: [{ id: "1", quantity: 2 }],
  shippingAddress: {
    street: "1 rue Test",
    city: "Yaoundé",
    country: "CM",
    postalCode: "0000",
  },
};

describe("orderService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crée une commande sans coupon", async () => {
    mockedProductRepo.findById.mockResolvedValue(
      makeProduct({ id: 1, price: 1000 }) as any,
    );
    mockedOrderRepo.create.mockResolvedValue(
      makeOrder({ totalAmount: 2000 }) as any,
    );

    const result = await orderService.create(1, baseDto as any);

    expect(mockedOrderRepo.create).toHaveBeenCalledWith(
      1,
      baseDto,
      2000,
      expect.any(Array),
      undefined,
    );
    expect(mockedPromoRepo.incrementCouponUsage).not.toHaveBeenCalled();
    expect(result.totalAmount).toBe(2000);
  });

  it("applique un coupon valide et enregistre son usage", async () => {
    mockedProductRepo.findById.mockResolvedValue(
      makeProduct({ id: 1, price: 1000 }) as any,
    );
    mockedPromoRepo.findCouponByCode.mockResolvedValue(makeCoupon() as any);
    mockedOrderRepo.create.mockResolvedValue(
      makeOrder({ id: "order_1" }) as any,
    );

    const dto = { ...baseDto, couponCode: "PROMO10" };
    await orderService.create(1, dto as any);

    expect(mockedOrderRepo.create).toHaveBeenCalledWith(
      1,
      dto,
      2000,
      expect.any(Array),
      "coupon_1",
    );
    expect(mockedPromoRepo.incrementCouponUsage).toHaveBeenCalledWith(
      "coupon_1",
    );
    expect(mockedPromoRepo.createCouponUse).toHaveBeenCalledWith(
      "coupon_1",
      1,
      "order_1",
    );
  });

  it("rejette un coupon inexistant", async () => {
    mockedProductRepo.findById.mockResolvedValue(
      makeProduct({ id: 1, price: 1000 }) as any,
    );
    mockedPromoRepo.findCouponByCode.mockResolvedValue(null);

    const dto = { ...baseDto, couponCode: "INVALID" };
    await expect(orderService.create(1, dto as any)).rejects.toThrow(AppError);
    expect(mockedOrderRepo.create).not.toHaveBeenCalled();
  });

  it("rejette un coupon déjà utilisé par cet utilisateur (perUserLimit atteint)", async () => {
    mockedProductRepo.findById.mockResolvedValue(
      makeProduct({ id: 1, price: 1000 }) as any,
    );
    mockedPromoRepo.findCouponByCode.mockResolvedValue(
      makeCoupon({ uses: [{ userId: 1 }] }) as any,
    );

    const dto = { ...baseDto, couponCode: "PROMO10" };
    await expect(orderService.create(1, dto as any)).rejects.toThrow(
      "maximum number of times",
    );
  });

  it("rejette si un produit est introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(null);

    await expect(orderService.create(1, baseDto as any)).rejects.toThrow(
      "Product 1 not found",
    );
  });
});

describe("orderService.updateStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crédite les points de fidélité quand la commande passe à DELIVERED", async () => {
    const order = makeOrder({
      status: "CONFIRMED",
      userId: 1,
      totalAmount: 5000,
    });
    mockedOrderRepo.findById.mockResolvedValue(order as any);
    mockedOrderRepo.updateStatus.mockResolvedValue({
      ...order,
      status: "DELIVERED",
    } as any);

    await orderService.updateStatus(
      "order_1",
      { status: "DELIVERED" } as any,
      42,
    );

    expect(mockedLoyalty.earnFromOrder).toHaveBeenCalledWith(
      1,
      "order_1",
      5000,
    );
  });

  it("ne crédite pas si déjà DELIVERED précédemment", async () => {
    const order = makeOrder({ status: "DELIVERED", userId: 1 });
    mockedOrderRepo.findById.mockResolvedValue(order as any);
    mockedOrderRepo.updateStatus.mockResolvedValue(order as any);

    await orderService.updateStatus(
      "order_1",
      { status: "DELIVERED" } as any,
      42,
    );

    expect(mockedLoyalty.earnFromOrder).not.toHaveBeenCalled();
  });
});
