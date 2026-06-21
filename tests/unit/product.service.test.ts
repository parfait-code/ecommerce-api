import { productService } from "../../src/modules/products/product.service";
import { productRepository } from "../../src/modules/products/product.repository";
import { variantRepository } from "../../src/modules/variants/variant.repository";
import { uploadImage, deleteImage } from "../../src/shared/utils/upload";
import { AppError } from "../../src/shared/utils/app-error";
import { makeProduct, makeProductImage } from "../mocks/factories";

jest.mock("../../src/modules/products/product.repository");
jest.mock("../../src/modules/variants/variant.repository");
jest.mock("../../src/shared/utils/upload");
jest.mock("../../src/shared/utils/cache", () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delByPattern: jest.fn(),
  },
}));
jest.mock("../../src/shared/logger", () => ({
  businessLogger: { log: jest.fn() },
  auditLogger: { log: jest.fn() },
}));

import { cache } from "../../src/shared/utils/cache";

const mockedRepo = productRepository as jest.Mocked<typeof productRepository>;
const mockedVariantRepo = variantRepository as jest.Mocked<
  typeof variantRepository
>;
const mockedCacheGet = cache.get as jest.Mock;
const mockedCacheSet = cache.set as jest.Mock;
const mockedCacheDel = cache.del as jest.Mock;
const mockedCacheDelByPattern = cache.delByPattern as jest.Mock;
const mockedUploadImage = uploadImage as jest.MockedFunction<
  typeof uploadImage
>;
const mockedDeleteImage = deleteImage as jest.MockedFunction<
  typeof deleteImage
>;

describe("productService.getAll", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retourne le cache si présent", async () => {
    mockedCacheGet.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const result: any = await productService.getAll({});

    expect(result.total).toBe(0);
    expect(mockedRepo.findAll).not.toHaveBeenCalled();
  });

  it("interroge le repository et met en cache si absent", async () => {
    mockedCacheGet.mockResolvedValue(null);
    mockedRepo.findAll.mockResolvedValue([[makeProduct()], 1] as any);

    const result: any = await productService.getAll({ page: "1", limit: "20" });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockedCacheSet).toHaveBeenCalled();
  });
});

describe("productService.getById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si produit introuvable", async () => {
    mockedCacheGet.mockResolvedValue(null);
    mockedRepo.findById.mockResolvedValue(null);

    await expect(productService.getById(99)).rejects.toThrow(AppError);
  });

  it("retourne le produit et le met en cache", async () => {
    mockedCacheGet.mockResolvedValue(null);
    mockedRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);

    const result: any = await productService.getById(1);

    expect(result.id).toBe(1);
    expect(mockedCacheSet).toHaveBeenCalledWith(
      "products:1",
      expect.any(Object),
    );
  });
});

describe("productService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crée le produit et invalide le cache liste", async () => {
    mockedRepo.create.mockResolvedValue(makeProduct({ id: 1 }) as any);

    const dto = {
      sku: "SKU-1",
      name: "Test",
      price: 1000,
      categoryId: "cat_1",
    };
    const result: any = await productService.create(dto as any);

    expect(result.id).toBe(1);
    expect(mockedCacheDelByPattern).toHaveBeenCalledWith("products:all:*");
  });
});

describe("productService.update", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si produit introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);

    await expect(
      productService.update(99, { price: 2000 } as any),
    ).rejects.toThrow(AppError);
  });

  it("logge PRICE_CHANGED si le prix change", async () => {
    mockedRepo.findById.mockResolvedValue(
      makeProduct({ id: 1, price: 1000 }) as any,
    );
    mockedRepo.update.mockResolvedValue(
      makeProduct({ id: 1, price: 1500 }) as any,
    );

    const { auditLogger } = await import("../../src/shared/logger");
    await productService.update(1, { price: 1500 } as any);

    expect(auditLogger.log).toHaveBeenCalledWith(
      "PRICE_CHANGED",
      expect.objectContaining({
        metadata: expect.objectContaining({ oldPrice: 1000, newPrice: 1500 }),
      }),
    );
  });

  it("ne logge pas PRICE_CHANGED si le prix ne change pas", async () => {
    mockedRepo.findById.mockResolvedValue(
      makeProduct({ id: 1, price: 1000 }) as any,
    );
    mockedRepo.update.mockResolvedValue(
      makeProduct({ id: 1, price: 1000 }) as any,
    );

    const { auditLogger } = await import("../../src/shared/logger");
    await productService.update(1, { name: "Renamed" } as any);

    expect(auditLogger.log).not.toHaveBeenCalledWith(
      "PRICE_CHANGED",
      expect.anything(),
    );
  });
});

describe("productService.delete", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si produit introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(productService.delete(99)).rejects.toThrow(AppError);
  });

  it("supprime et invalide le cache", async () => {
    mockedRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.delete.mockResolvedValue(makeProduct({ id: 1 }) as any);

    const result = await productService.delete(1);

    expect(result.numberOfProductsDeleted).toBe(1);
    expect(mockedCacheDel).toHaveBeenCalledWith("products:1");
  });
});

describe("productService.uploadImages", () => {
  beforeEach(() => jest.clearAllMocks());

  const files = [
    { originalname: "a.jpg", buffer: Buffer.from(""), mimetype: "image/jpeg" },
  ] as any;

  it("rejette si produit introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(productService.uploadImages(99, files)).rejects.toThrow(
      AppError,
    );
  });

  it("rejette si le variant n'appartient pas au produit", async () => {
    mockedRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedVariantRepo.findById.mockResolvedValue({
      id: "v1",
      productId: 2,
    } as any);

    await expect(productService.uploadImages(1, files, "v1")).rejects.toThrow(
      "Variant not found on this product",
    );
  });

  it("upload les fichiers et rafraîchit le produit", async () => {
    mockedRepo.findById
      .mockResolvedValueOnce(makeProduct({ id: 1 }) as any)
      .mockResolvedValueOnce(
        makeProduct({ id: 1, images: [makeProductImage()] }) as any,
      );
    mockedUploadImage.mockResolvedValue(
      "https://r2.example.com/products/x.jpg",
    );

    const result: any = await productService.uploadImages(1, files);

    expect(mockedUploadImage).toHaveBeenCalledTimes(1);
    expect(mockedRepo.addImages).toHaveBeenCalledWith(
      1,
      ["https://r2.example.com/products/x.jpg"],
      undefined,
    );
    expect(result.images).toHaveLength(1);
  });
});

describe("productService.deleteImage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si produit introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(productService.deleteImage(99, "img_1")).rejects.toThrow(
      AppError,
    );
  });

  it("rejette si l'image n'appartient pas au produit", async () => {
    mockedRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findImageById.mockResolvedValue(
      makeProductImage({ productId: 2 }) as any,
    );

    await expect(productService.deleteImage(1, "img_1")).rejects.toThrow(
      "Image not found",
    );
  });

  it("supprime l'image sur R2 et en base", async () => {
    mockedRepo.findById
      .mockResolvedValueOnce(makeProduct({ id: 1 }) as any)
      .mockResolvedValueOnce(makeProduct({ id: 1, images: [] }) as any);
    mockedRepo.findImageById.mockResolvedValue(
      makeProductImage({ productId: 1 }) as any,
    );

    await productService.deleteImage(1, "img_1");

    expect(mockedDeleteImage).toHaveBeenCalledWith(
      "https://r2.example.com/products/img_1.jpg",
    );
    expect(mockedRepo.deleteImage).toHaveBeenCalledWith("img_1");
  });
});
