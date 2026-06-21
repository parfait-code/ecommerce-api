import { basketService } from "../../src/modules/basket/basket.service";
import { basketRepository } from "../../src/modules/basket/basket.repository";
import { productRepository } from "../../src/modules/products/product.repository";
import { variantRepository } from "../../src/modules/variants/variant.repository";
import { AppError } from "../../src/shared/utils/app-error";
import {
  makeProduct,
  makeBasket,
  makeBasketItem,
  makeVariant,
} from "../mocks/factories";

jest.mock("../../src/modules/basket/basket.repository");
jest.mock("../../src/modules/products/product.repository");
jest.mock("../../src/modules/variants/variant.repository");

const mockedRepo = basketRepository as jest.Mocked<typeof basketRepository>;
const mockedProductRepo = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedVariantRepo = variantRepository as jest.Mocked<
  typeof variantRepository
>;

describe("basketService.getById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si panier introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(basketService.getById("basket_99")).rejects.toThrow(AppError);
  });
});

describe("basketService.addProduct", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = { product_id: 1, quantity: 2 };

  it("rejette si panier introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(
      basketService.addProduct("basket_99", dto as any),
    ).rejects.toThrow("Basket not found");
  });

  it("rejette si produit introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(makeBasket() as any);
    mockedProductRepo.findById.mockResolvedValue(null);

    await expect(
      basketService.addProduct("basket_1", dto as any),
    ).rejects.toThrow("Product not found");
  });

  it("rejette si le variant n'appartient pas au produit", async () => {
    mockedRepo.findById.mockResolvedValue(makeBasket() as any);
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedVariantRepo.findById.mockResolvedValue(
      makeVariant({ productId: 2 }) as any,
    );

    await expect(
      basketService.addProduct("basket_1", { ...dto, variant_id: "v1" } as any),
    ).rejects.toThrow("Variant not found on this product");
  });

  it("rejette si le variant n'est pas actif", async () => {
    mockedRepo.findById.mockResolvedValue(makeBasket() as any);
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedVariantRepo.findById.mockResolvedValue(
      makeVariant({ productId: 1, isActive: false }) as any,
    );

    await expect(
      basketService.addProduct("basket_1", { ...dto, variant_id: "v1" } as any),
    ).rejects.toThrow("Variant is not available");
  });

  it("ajoute le produit et retourne le panier mis à jour", async () => {
    mockedRepo.findById
      .mockResolvedValueOnce(makeBasket() as any)
      .mockResolvedValueOnce(makeBasket({ items: [makeBasketItem()] }) as any);
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);

    const result = await basketService.addProduct("basket_1", dto as any);

    expect(mockedRepo.addItem).toHaveBeenCalledWith(
      "basket_1",
      1,
      2,
      undefined,
    );
    expect(result.items).toHaveLength(1);
  });
});

describe("basketService.updateQuantity", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si panier introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(
      basketService.updateQuantity("basket_99", {
        product_id: 1,
        quantity: 3,
      } as any),
    ).rejects.toThrow("Basket not found");
  });

  it("rejette si le produit n'est pas dans le panier", async () => {
    mockedRepo.findById.mockResolvedValue(makeBasket({ items: [] }) as any);

    await expect(
      basketService.updateQuantity("basket_1", {
        product_id: 1,
        quantity: 3,
      } as any),
    ).rejects.toThrow("Product not in basket");
  });

  it("met à jour la quantité", async () => {
    mockedRepo.findById
      .mockResolvedValueOnce(
        makeBasket({
          items: [makeBasketItem({ productId: 1, variantId: null })],
        }) as any,
      )
      .mockResolvedValueOnce(
        makeBasket({
          items: [makeBasketItem({ productId: 1, quantity: 5 })],
        }) as any,
      );

    const result = await basketService.updateQuantity("basket_1", {
      product_id: 1,
      quantity: 5,
    } as any);

    expect(mockedRepo.updateQuantity).toHaveBeenCalledWith(
      "basket_1",
      1,
      5,
      undefined,
    );
    expect(result.items[0].quantity).toBe(5);
  });

  it("distingue les variants — un item avec variant_id différent ne matche pas", async () => {
    mockedRepo.findById.mockResolvedValue(
      makeBasket({
        items: [makeBasketItem({ productId: 1, variantId: "v1" })],
      }) as any,
    );

    await expect(
      basketService.updateQuantity("basket_1", {
        product_id: 1,
        quantity: 5,
      } as any),
    ).rejects.toThrow("Product not in basket");
  });
});

describe("basketService.removeProduct", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si le produit n'est pas dans le panier", async () => {
    mockedRepo.findById.mockResolvedValue(makeBasket({ items: [] }) as any);

    await expect(
      basketService.removeProduct("basket_1", { product_id: 1 } as any),
    ).rejects.toThrow("Product not in basket");
  });

  it("retire le produit du panier", async () => {
    mockedRepo.findById
      .mockResolvedValueOnce(
        makeBasket({
          items: [makeBasketItem({ productId: 1, variantId: null })],
        }) as any,
      )
      .mockResolvedValueOnce(makeBasket({ items: [] }) as any);

    const result = await basketService.removeProduct("basket_1", {
      product_id: 1,
    } as any);

    expect(mockedRepo.removeItem).toHaveBeenCalledWith(
      "basket_1",
      1,
      undefined,
    );
    expect(result.items).toHaveLength(0);
  });
});
