// tests/unit/attribute.service.test.ts
import { attributeService } from "../../src/modules/attributes/attribute.service";
import { attributeRepository } from "../../src/modules/attributes/attribute.repository";
import { categoryRepository } from "../../src/modules/categories/category.repository";
import { productRepository } from "../../src/modules/products/product.repository";
import { AppError } from "../../src/shared/utils/app-error";
import {
  makeCategory,
  makeProduct,
  makeAttributeDefinition,
} from "../mocks/factories";

jest.mock("../../src/modules/attributes/attribute.repository");
jest.mock("../../src/modules/categories/category.repository");
jest.mock("../../src/modules/products/product.repository");
jest.mock("../../src/shared/utils/cache", () => ({
  cache: { del: jest.fn() },
}));

const mockedAttrRepo = attributeRepository as jest.Mocked<
  typeof attributeRepository
>;
const mockedCatRepo = categoryRepository as jest.Mocked<
  typeof categoryRepository
>;
const mockedProductRepo = productRepository as jest.Mocked<
  typeof productRepository
>;

describe("attributeService.getByCategory", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si la catégorie est introuvable", async () => {
    mockedCatRepo.findById.mockResolvedValue(null);
    await expect(attributeService.getByCategory("cat_99")).rejects.toThrow(
      "Category not found",
    );
  });

  it("retourne les définitions d'attributs", async () => {
    mockedCatRepo.findById.mockResolvedValue(makeCategory() as any);
    mockedAttrRepo.findAllByCategory.mockResolvedValue([
      makeAttributeDefinition(),
    ] as any);

    const result = await attributeService.getByCategory("cat_1");
    expect(result).toHaveLength(1);
  });
});

describe("attributeService.getDefinitionById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedAttrRepo.findDefinitionById.mockResolvedValue(null);
    await expect(attributeService.getDefinitionById("attr_99")).rejects.toThrow(
      "Attribute definition not found",
    );
  });

  it("retourne la définition", async () => {
    mockedAttrRepo.findDefinitionById.mockResolvedValue(
      makeAttributeDefinition() as any,
    );
    const result = await attributeService.getDefinitionById("attr_1");
    expect(result.id).toBe("attr_1");
  });
});

describe("attributeService.createDefinition", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = {
    name: "Couleur",
    slug: "couleur",
    type: "SELECT",
    isVariant: true,
    isFilterable: true,
    isRequired: false,
    position: 0,
  };

  it("rejette si la catégorie est introuvable", async () => {
    mockedCatRepo.findById.mockResolvedValue(null);
    await expect(
      attributeService.createDefinition("cat_99", dto as any),
    ).rejects.toThrow("Category not found");
  });

  it("rejette si le slug existe déjà dans cette catégorie", async () => {
    mockedCatRepo.findById.mockResolvedValue(makeCategory() as any);
    mockedAttrRepo.findDefinitionBySlug.mockResolvedValue(
      makeAttributeDefinition() as any,
    );

    await expect(
      attributeService.createDefinition("cat_1", dto as any),
    ).rejects.toThrow("Attribute slug already exists in this category");
  });

  it("crée la définition d'attribut", async () => {
    mockedCatRepo.findById.mockResolvedValue(makeCategory() as any);
    mockedAttrRepo.findDefinitionBySlug.mockResolvedValue(null);
    mockedAttrRepo.createDefinition.mockResolvedValue(
      makeAttributeDefinition() as any,
    );

    const result = await attributeService.createDefinition("cat_1", dto as any);
    expect(result.id).toBe("attr_1");
  });
});

describe("attributeService.updateDefinition", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si la définition est introuvable", async () => {
    mockedAttrRepo.findDefinitionById.mockResolvedValue(null);
    await expect(
      attributeService.updateDefinition("attr_99", { name: "X" } as any),
    ).rejects.toThrow("Attribute definition not found");
  });

  it("rejette si le nouveau slug est déjà pris dans la catégorie", async () => {
    mockedAttrRepo.findDefinitionById.mockResolvedValue(
      makeAttributeDefinition({ slug: "old-slug" }) as any,
    );
    mockedAttrRepo.findDefinitionBySlug.mockResolvedValue(
      makeAttributeDefinition() as any,
    );

    await expect(
      attributeService.updateDefinition("attr_1", { slug: "new-slug" } as any),
    ).rejects.toThrow("Attribute slug already exists in this category");
  });

  it("met à jour si le slug n'est pas modifié", async () => {
    const def = makeAttributeDefinition({ slug: "couleur" });
    mockedAttrRepo.findDefinitionById.mockResolvedValue(def as any);
    mockedAttrRepo.updateDefinition.mockResolvedValue(def as any);

    const result = await attributeService.updateDefinition("attr_1", {
      slug: "couleur",
    } as any);
    expect(result.id).toBe("attr_1");
    expect(mockedAttrRepo.findDefinitionBySlug).not.toHaveBeenCalled();
  });

  it("met à jour avec succès", async () => {
    mockedAttrRepo.findDefinitionById.mockResolvedValue(
      makeAttributeDefinition({ slug: "old" }) as any,
    );
    mockedAttrRepo.findDefinitionBySlug.mockResolvedValue(null);
    mockedAttrRepo.updateDefinition.mockResolvedValue(
      makeAttributeDefinition({ name: "Taille" }) as any,
    );

    const result = await attributeService.updateDefinition("attr_1", {
      slug: "taille",
      name: "Taille",
    } as any);
    expect(result.name).toBe("Taille");
  });
});

describe("attributeService.deleteDefinition", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedAttrRepo.findDefinitionById.mockResolvedValue(null);
    await expect(attributeService.deleteDefinition("attr_99")).rejects.toThrow(
      "Attribute definition not found",
    );
  });

  it("supprime avec succès", async () => {
    mockedAttrRepo.findDefinitionById.mockResolvedValue(
      makeAttributeDefinition() as any,
    );
    mockedAttrRepo.deleteDefinition.mockResolvedValue({} as any);

    const result = await attributeService.deleteDefinition("attr_1");
    expect(result.message).toBe("Attribute definition deleted successfully");
  });
});

describe("attributeService.createOption", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si la définition est introuvable", async () => {
    mockedAttrRepo.findDefinitionById.mockResolvedValue(null);
    await expect(
      attributeService.createOption("attr_99", { value: "Rouge", position: 0 }),
    ).rejects.toThrow("Attribute definition not found");
  });

  it("crée l'option avec succès", async () => {
    mockedAttrRepo.findDefinitionById.mockResolvedValue(
      makeAttributeDefinition() as any,
    );
    mockedAttrRepo.createOption.mockResolvedValue({
      id: "opt_1",
      value: "Rouge",
    } as any);

    const result = await attributeService.createOption("attr_1", {
      value: "Rouge",
      position: 0,
    });
    expect(result.id).toBe("opt_1");
  });
});

describe("attributeService.deleteOption", () => {
  beforeEach(() => jest.clearAllMocks());

  it("supprime l'option et retourne un message", async () => {
    mockedAttrRepo.deleteOption.mockResolvedValue({} as any);

    const result = await attributeService.deleteOption("opt_1");
    expect(result.message).toBe("Option deleted successfully");
  });
});

describe("attributeService.setProductAttributes", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = {
    attributes: [{ attributeDefinitionId: "attr_1", value: "Rouge" }],
  };

  it("rejette si le produit est introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(null);
    await expect(
      attributeService.setProductAttributes(99, dto as any),
    ).rejects.toThrow("Product not found");
  });

  it("rejette si la définition d'attribut est introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(
      makeProduct({ categoryId: "cat_1" }) as any,
    );
    mockedAttrRepo.findDefinitionById.mockResolvedValue(null);

    await expect(
      attributeService.setProductAttributes(1, dto as any),
    ).rejects.toThrow("not found");
  });

  it("rejette si l'attribut n'appartient pas à la catégorie du produit", async () => {
    mockedProductRepo.findById.mockResolvedValue(
      makeProduct({ categoryId: "cat_1" }) as any,
    );
    mockedAttrRepo.findDefinitionById.mockResolvedValue(
      makeAttributeDefinition({ categoryId: "cat_2" }) as any,
    );

    await expect(
      attributeService.setProductAttributes(1, dto as any),
    ).rejects.toThrow("does not belong to this product's category");
  });

  it("assigne les attributs avec succès et invalide le cache", async () => {
    mockedProductRepo.findById.mockResolvedValue(
      makeProduct({ id: 1, categoryId: "cat_1" }) as any,
    );
    mockedAttrRepo.findDefinitionById.mockResolvedValue(
      makeAttributeDefinition({ categoryId: "cat_1" }) as any,
    );
    mockedAttrRepo.setProductAttributes.mockResolvedValue([
      { id: "pav_1", value: "Rouge" },
    ] as any);

    const { cache } = await import("../../src/shared/utils/cache");
    const result = await attributeService.setProductAttributes(1, dto as any);

    expect(result).toHaveLength(1);
    expect(cache.del).toHaveBeenCalledWith("products:1");
  });
});
