import { variantService } from "../../src/modules/variants/variant.service";
import { variantRepository } from "../../src/modules/variants/variant.repository";
import { productRepository } from "../../src/modules/products/product.repository";
import { attributeRepository } from "../../src/modules/attributes/attribute.repository";
import { AppError } from "../../src/shared/utils/app-error";
import {
  makeProduct,
  makeVariant,
  makeAttributeDefinition,
} from "../mocks/factories";

jest.mock("../../src/modules/variants/variant.repository");
jest.mock("../../src/modules/products/product.repository");
jest.mock("../../src/modules/attributes/attribute.repository");

const mockedRepo = variantRepository as jest.Mocked<typeof variantRepository>;
const mockedProductRepo = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedAttrRepo = attributeRepository as jest.Mocked<
  typeof attributeRepository
>;

describe("variantService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = {
    sku: "SKU-VAR-1",
    isActive: true,
    attributes: [{ attributeDefinitionId: "attr_1", value: "Rouge" }],
  };

  it("rejette si produit introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(null);
    await expect(variantService.create(99, dto as any)).rejects.toThrow(
      "Product not found",
    );
  });

  it("rejette si le SKU est déjà pris", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findBySku.mockResolvedValue(makeVariant() as any);

    await expect(variantService.create(1, dto as any)).rejects.toThrow(
      "SKU already taken",
    );
  });

  it("rejette si une définition d'attribut est introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findBySku.mockResolvedValue(null);
    mockedAttrRepo.findDefinitionById.mockResolvedValue(null);

    await expect(variantService.create(1, dto as any)).rejects.toThrow(
      "Attribute definition attr_1 not found",
    );
  });

  it("rejette si l'attribut n'appartient pas à la catégorie du produit", async () => {
    mockedProductRepo.findById.mockResolvedValue(
      makeProduct({ id: 1, categoryId: "cat_1" }) as any,
    );
    mockedRepo.findBySku.mockResolvedValue(null);
    mockedAttrRepo.findDefinitionById.mockResolvedValue(
      makeAttributeDefinition({ categoryId: "cat_2" }) as any,
    );

    await expect(variantService.create(1, dto as any)).rejects.toThrow(
      "does not belong to category",
    );
  });

  it("rejette si l'attribut n'est pas marqué isVariant", async () => {
    mockedProductRepo.findById.mockResolvedValue(
      makeProduct({ id: 1, categoryId: "cat_1" }) as any,
    );
    mockedRepo.findBySku.mockResolvedValue(null);
    mockedAttrRepo.findDefinitionById.mockResolvedValue(
      makeAttributeDefinition({ categoryId: "cat_1", isVariant: false }) as any,
    );

    await expect(variantService.create(1, dto as any)).rejects.toThrow(
      "is not a variant attribute",
    );
  });

  it("crée le variant et invalide le cache produit", async () => {
    mockedProductRepo.findById.mockResolvedValue(
      makeProduct({ id: 1, categoryId: "cat_1" }) as any,
    );
    mockedRepo.findBySku.mockResolvedValue(null);
    mockedAttrRepo.findDefinitionById.mockResolvedValue(
      makeAttributeDefinition({ categoryId: "cat_1", isVariant: true }) as any,
    );
    mockedRepo.create.mockResolvedValue(makeVariant({ id: "v1" }) as any);

    const result = await variantService.create(1, dto as any);

    expect(result.id).toBe("v1");
    expect(mockedRepo.create).toHaveBeenCalledWith(1, dto);
  });
});

describe("variantService.update / delete", () => {
  beforeEach(() => jest.clearAllMocks());

  it("update rejette si le variant introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(
      variantService.update("v1", 1, { sku: "NEW" } as any),
    ).rejects.toThrow(AppError);
  });

  it("update rejette si le variant n'appartient pas au produit donné", async () => {
    mockedRepo.findById.mockResolvedValue(makeVariant({ productId: 2 }) as any);
    await expect(
      variantService.update("v1", 1, { sku: "NEW" } as any),
    ).rejects.toThrow("Variant not found on this product");
  });

  it("update rejette si le nouveau SKU est déjà pris", async () => {
    mockedRepo.findById.mockResolvedValue(
      makeVariant({ productId: 1, sku: "OLD" }) as any,
    );
    mockedRepo.findBySku.mockResolvedValue(makeVariant({ sku: "NEW" }) as any);

    await expect(
      variantService.update("v1", 1, { sku: "NEW" } as any),
    ).rejects.toThrow("SKU already taken");
  });

  it("delete rejette si introuvable sur ce produit", async () => {
    mockedRepo.findById.mockResolvedValue(makeVariant({ productId: 2 }) as any);
    await expect(variantService.delete("v1", 1)).rejects.toThrow(
      "Variant not found on this product",
    );
  });

  it("delete réussit", async () => {
    mockedRepo.findById.mockResolvedValue(makeVariant({ productId: 1 }) as any);
    const result = await variantService.delete("v1", 1);
    expect(result.message).toBe("Variant deleted successfully");
  });
});
