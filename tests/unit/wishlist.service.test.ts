// tests/unit/wishlist.service.test.ts
import { wishlistService } from "../../src/modules/wishlist/wishlist.service";
import { wishlistRepository } from "../../src/modules/wishlist/wishlist.repository";
import { productRepository } from "../../src/modules/products/product.repository";
import { variantRepository } from "../../src/modules/variants/variant.repository";
import { makeProduct, makeVariant } from "../mocks/factories";

jest.mock("../../src/modules/wishlist/wishlist.repository");
jest.mock("../../src/modules/products/product.repository");
jest.mock("../../src/modules/variants/variant.repository");
jest.mock("../../src/shared/logger", () => ({
  businessLogger: { log: jest.fn() },
}));

const mockedRepo = wishlistRepository as jest.Mocked<typeof wishlistRepository>;
const mockedProductRepo = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedVariantRepo = variantRepository as jest.Mocked<
  typeof variantRepository
>;

const makeWishlist = (overrides: Partial<any> = {}) => ({
  id: "wl_1",
  userId: 1,
  items: [],
  ...overrides,
});

describe("wishlistService.addItem", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si produit introuvable", async () => {
    mockedRepo.findByUserId.mockResolvedValue(makeWishlist() as any);
    mockedProductRepo.findById.mockResolvedValue(null);

    await expect(
      wishlistService.addItem(1, { product_id: 99 } as any),
    ).rejects.toThrow("Product not found");
  });

  it("rejette si le variant n'appartient pas au produit", async () => {
    mockedRepo.findByUserId.mockResolvedValue(makeWishlist() as any);
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedVariantRepo.findById.mockResolvedValue(
      makeVariant({ productId: 2 }) as any,
    );

    await expect(
      wishlistService.addItem(1, { product_id: 1, variant_id: "v1" } as any),
    ).rejects.toThrow("Variant not found on this product");
  });

  it("crée la wishlist si elle n'existe pas encore (getOrCreate)", async () => {
    mockedRepo.findByUserId.mockResolvedValue(null);
    mockedRepo.create.mockResolvedValue(makeWishlist() as any);
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.addItem.mockResolvedValue({} as any);
    mockedRepo.findByUserId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        makeWishlist({ items: [{ productId: 1 }] }) as any,
      );

    await wishlistService.addItem(1, { product_id: 1 } as any);
    expect(mockedRepo.create).toHaveBeenCalledWith(1);
  });
});

describe("wishlistService.removeItem", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si le produit n'est pas dans la wishlist", async () => {
    mockedRepo.findByUserId.mockResolvedValue(
      makeWishlist({ items: [] }) as any,
    );

    await expect(
      wishlistService.removeItem(1, { product_id: 1 } as any),
    ).rejects.toThrow("Product not in wishlist");
  });

  it("retire le produit avec succès", async () => {
    mockedRepo.findByUserId.mockResolvedValue(
      makeWishlist({
        items: [{ productId: 1, variantId: null }],
      }) as any,
    );
    mockedRepo.removeItem.mockResolvedValue({} as any);
    mockedRepo.findByUserId
      .mockResolvedValueOnce(
        makeWishlist({ items: [{ productId: 1, variantId: null }] }) as any,
      )
      .mockResolvedValueOnce(makeWishlist({ items: [] }) as any);

    await wishlistService.removeItem(1, { product_id: 1 } as any);
    expect(mockedRepo.removeItem).toHaveBeenCalledWith("wl_1", 1, undefined);
  });
});
