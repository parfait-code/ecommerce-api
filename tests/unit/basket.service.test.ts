import { basketService } from "../../src/modules/basket/basket.service";
import { basketRepository } from "../../src/modules/basket/basket.repository";
import { productRepository } from "../../src/modules/products/product.repository";
import { AppError } from "../../src/shared/utils/app-error";

jest.mock("../../src/modules/basket/basket.repository");
jest.mock("../../src/modules/products/product.repository");

const mockBasketRepository = basketRepository as jest.Mocked<
  typeof basketRepository
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

const mockBasket = {
  id: "basket-cuid-1",
  userId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
};

const mockBasketWithItem = {
  ...mockBasket,
  items: [
    {
      id: "item-cuid-1",
      basketId: "basket-cuid-1",
      productId: 1,
      quantity: 2,
      product: mockProduct,
    },
  ],
};

describe("BasketService", () => {
  describe("create", () => {
    it("should create a basket for a user", async () => {
      mockBasketRepository.create.mockResolvedValue(mockBasket);

      const result = await basketService.create(1);

      expect(mockBasketRepository.create).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockBasket);
    });
  });

  describe("getById", () => {
    it("should return basket if found", async () => {
      mockBasketRepository.findById.mockResolvedValue(mockBasket);

      const result = await basketService.getById("basket-cuid-1");

      expect(result).toEqual(mockBasket);
    });

    it("should throw 404 if basket not found", async () => {
      mockBasketRepository.findById.mockResolvedValue(null);

      await expect(basketService.getById("nonexistent")).rejects.toThrow(
        new AppError("Basket not found", 404),
      );
    });
  });

  describe("addProduct", () => {
    it("should add a product to the basket", async () => {
      mockBasketRepository.findById
        .mockResolvedValueOnce(mockBasket) // basket exists check
        .mockResolvedValueOnce(mockBasketWithItem); // return updated basket
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockBasketRepository.addItem.mockResolvedValue({
        id: "item-cuid-1",
        basketId: "basket-cuid-1",
        productId: 1,
        quantity: 2,
      });

      const result = await basketService.addProduct("basket-cuid-1", {
        product_id: 1,
        quantity: 2,
      });

      expect(mockBasketRepository.addItem).toHaveBeenCalledWith(
        "basket-cuid-1",
        1,
        2,
      );
      expect(result).toEqual(mockBasketWithItem);
    });

    it("should throw 404 if basket not found", async () => {
      mockBasketRepository.findById.mockResolvedValue(null);

      await expect(
        basketService.addProduct("nonexistent", { product_id: 1, quantity: 1 }),
      ).rejects.toThrow(new AppError("Basket not found", 404));
    });

    it("should throw 404 if product not found", async () => {
      mockBasketRepository.findById.mockResolvedValue(mockBasket);
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(
        basketService.addProduct("basket-cuid-1", {
          product_id: 999,
          quantity: 1,
        }),
      ).rejects.toThrow(new AppError("Product not found", 404));
    });
  });

  describe("updateQuantity", () => {
    it("should update the quantity of an existing item", async () => {
      mockBasketRepository.findById
        .mockResolvedValueOnce(mockBasketWithItem)
        .mockResolvedValueOnce({
          ...mockBasketWithItem,
          items: [{ ...mockBasketWithItem.items[0], quantity: 5 }],
        });
      mockBasketRepository.updateQuantity.mockResolvedValue({
        id: "item-cuid-1",
        basketId: "basket-cuid-1",
        productId: 1,
        quantity: 5,
      });

      const result = await basketService.updateQuantity("basket-cuid-1", {
        product_id: 1,
        quantity: 5,
      });

      expect(mockBasketRepository.updateQuantity).toHaveBeenCalledWith(
        "basket-cuid-1",
        1,
        5,
      );
      expect(result?.items[0].quantity).toBe(5);
    });

    it("should throw 404 if basket not found", async () => {
      mockBasketRepository.findById.mockResolvedValue(null);

      await expect(
        basketService.updateQuantity("nonexistent", {
          product_id: 1,
          quantity: 5,
        }),
      ).rejects.toThrow(new AppError("Basket not found", 404));
    });

    it("should throw 404 if product not in basket", async () => {
      mockBasketRepository.findById.mockResolvedValue(mockBasket); // empty items

      await expect(
        basketService.updateQuantity("basket-cuid-1", {
          product_id: 999,
          quantity: 5,
        }),
      ).rejects.toThrow(new AppError("Product not in basket", 404));
    });
  });

  describe("removeProduct", () => {
    it("should remove a product from the basket", async () => {
      mockBasketRepository.findById
        .mockResolvedValueOnce(mockBasketWithItem)
        .mockResolvedValueOnce(mockBasket); // basket after removal (empty)
      mockBasketRepository.removeItem.mockResolvedValue({
        id: "item-cuid-1",
        basketId: "basket-cuid-1",
        productId: 1,
        quantity: 2,
      });

      const result = await basketService.removeProduct("basket-cuid-1", {
        product_id: 1,
      });

      expect(mockBasketRepository.removeItem).toHaveBeenCalledWith(
        "basket-cuid-1",
        1,
      );
      expect(result).toEqual(mockBasket);
    });

    it("should throw 404 if basket not found", async () => {
      mockBasketRepository.findById.mockResolvedValue(null);

      await expect(
        basketService.removeProduct("nonexistent", { product_id: 1 }),
      ).rejects.toThrow(new AppError("Basket not found", 404));
    });

    it("should throw 404 if product not in basket", async () => {
      mockBasketRepository.findById.mockResolvedValue(mockBasket); // empty items

      await expect(
        basketService.removeProduct("basket-cuid-1", { product_id: 999 }),
      ).rejects.toThrow(new AppError("Product not in basket", 404));
    });
  });
});
