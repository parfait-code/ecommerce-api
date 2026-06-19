import { checkoutService } from "../../src/modules/checkout/checkout.service";
import { checkoutRepository } from "../../src/modules/checkout/checkout.repository";
import { basketRepository } from "../../src/modules/basket/basket.repository";
import { orderRepository } from "../../src/modules/orders/order.repository";
import { AppError } from "../../src/shared/utils/app-error";

jest.mock("../../src/modules/checkout/checkout.repository");
jest.mock("../../src/modules/basket/basket.repository");
jest.mock("../../src/modules/orders/order.repository");

const mockCheckoutRepository = checkoutRepository as jest.Mocked<
  typeof checkoutRepository
>;
const mockBasketRepository = basketRepository as jest.Mocked<
  typeof basketRepository
>;
const mockOrderRepository = orderRepository as jest.Mocked<
  typeof orderRepository
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

const mockBasketWithItems = {
  id: "basket-cuid-1",
  userId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: "item-1",
      basketId: "basket-cuid-1",
      productId: 1,
      quantity: 3,
      product: mockProduct,
    },
  ],
};

const mockEmptyBasket = {
  ...mockBasketWithItems,
  items: [],
};

const shippingAddress = {
  street: "123 Rue Principale",
  city: "Yaoundé",
  country: "CM",
  postalCode: "00000",
};

const mockCheckout = {
  id: "checkout-cuid-1",
  userId: 1,
  basketId: "basket-cuid-1",
  status: "PENDING",
  shippingAddress,
  billingAddress: null,
  paymentMethodId: null,
  total: 150.0,
  items: [{ productId: 1, name: "Test Product", price: 50.0, quantity: 3 }],
  orderId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 1, username: "testuser", email: "test@example.com" },
};

const mockOrder = {
  id: "order-cuid-1",
  userId: 1,
  status: "PENDING",
  shippingAddress,
  billingAddress: null,
  paymentMethodId: null,
  notes: null,
  couponCode: null,
  totalAmount: 150.0,
  discountedAmount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
  user: { id: 1, username: "testuser", email: "test@example.com" },
};

const mockCreateDto = {
  basket_id: "basket-cuid-1",
  shipping_address: shippingAddress,
};

describe("CheckoutService", () => {
  describe("create", () => {
    it("should create a checkout from a basket", async () => {
      mockBasketRepository.findById.mockResolvedValue(mockBasketWithItems);
      mockCheckoutRepository.create.mockResolvedValue(mockCheckout);

      const result = await checkoutService.create(1, mockCreateDto);

      expect(mockBasketRepository.findById).toHaveBeenCalledWith(
        "basket-cuid-1",
      );
      expect(mockCheckoutRepository.create).toHaveBeenCalledWith(
        1,
        mockCreateDto,
        150.0,
        [{ productId: 1, name: "Test Product", price: 50.0, quantity: 3 }],
      );
      expect(result).toEqual(mockCheckout);
    });

    it("should throw 404 if basket not found", async () => {
      mockBasketRepository.findById.mockResolvedValue(null);

      await expect(checkoutService.create(1, mockCreateDto)).rejects.toThrow(
        new AppError("Basket not found", 404),
      );
    });

    it("should throw 400 if basket is empty", async () => {
      mockBasketRepository.findById.mockResolvedValue(mockEmptyBasket);

      await expect(checkoutService.create(1, mockCreateDto)).rejects.toThrow(
        new AppError("Basket is empty", 400),
      );
    });

    it("should correctly compute the total from basket items", async () => {
      mockBasketRepository.findById.mockResolvedValue(mockBasketWithItems);
      mockCheckoutRepository.create.mockResolvedValue(mockCheckout);

      await checkoutService.create(1, mockCreateDto);

      // price(50) * quantity(3) = 150
      expect(mockCheckoutRepository.create).toHaveBeenCalledWith(
        1,
        expect.anything(),
        150.0,
        expect.anything(),
      );
    });
  });

  describe("getById", () => {
    it("should return checkout if found", async () => {
      mockCheckoutRepository.findById.mockResolvedValue(mockCheckout);

      const result = await checkoutService.getById("checkout-cuid-1");

      expect(result).toEqual(mockCheckout);
    });

    it("should throw 404 if checkout not found", async () => {
      mockCheckoutRepository.findById.mockResolvedValue(null);

      await expect(checkoutService.getById("nonexistent")).rejects.toThrow(
        new AppError("Checkout not found", 404),
      );
    });
  });

  describe("complete", () => {
    it("should complete checkout and create an order", async () => {
      const completedCheckout = {
        ...mockCheckout,
        status: "COMPLETED",
        orderId: "order-cuid-1",
      };
      mockCheckoutRepository.findById.mockResolvedValue(mockCheckout);
      mockOrderRepository.create.mockResolvedValue(mockOrder);
      mockCheckoutRepository.complete.mockResolvedValue(completedCheckout);

      const result = await checkoutService.complete("checkout-cuid-1", 1);

      expect(mockOrderRepository.create).toHaveBeenCalled();
      expect(mockCheckoutRepository.complete).toHaveBeenCalledWith(
        "checkout-cuid-1",
        "order-cuid-1",
      );
      expect(result.status).toBe("COMPLETED");
      expect(result.orderId).toBe("order-cuid-1");
    });

    it("should throw 404 if checkout not found", async () => {
      mockCheckoutRepository.findById.mockResolvedValue(null);

      await expect(checkoutService.complete("nonexistent", 1)).rejects.toThrow(
        new AppError("Checkout not found", 404),
      );
    });

    it("should throw 403 if user does not own the checkout", async () => {
      mockCheckoutRepository.findById.mockResolvedValue(mockCheckout); // userId: 1

      await expect(
        checkoutService.complete("checkout-cuid-1", 99),
      ).rejects.toThrow(new AppError("Forbidden", 403));
    });

    it("should throw 400 if checkout already completed", async () => {
      const completedCheckout = { ...mockCheckout, status: "COMPLETED" };
      mockCheckoutRepository.findById.mockResolvedValue(completedCheckout);

      await expect(
        checkoutService.complete("checkout-cuid-1", 1),
      ).rejects.toThrow(new AppError("Checkout already completed", 400));
    });
  });
});
