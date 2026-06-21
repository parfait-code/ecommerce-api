import { categoryService } from "../../src/modules/categories/category.service";
import { categoryRepository } from "../../src/modules/categories/category.repository";
import { AppError } from "../../src/shared/utils/app-error";
import { makeCategory } from "../mocks/factories";

jest.mock("../../src/modules/categories/category.repository");
jest.mock("../../src/shared/utils/cache", () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delByPattern: jest.fn(),
  },
}));

import { cache } from "../../src/shared/utils/cache";

const mockedRepo = categoryRepository as jest.Mocked<typeof categoryRepository>;
const mockedCacheGet = cache.get as jest.Mock;
const mockedCacheDel = cache.del as jest.Mock;

describe("categoryService.getById / getBySlug", () => {
  beforeEach(() => jest.clearAllMocks());

  it("getById rejette si introuvable", async () => {
    mockedCacheGet.mockResolvedValue(null);
    mockedRepo.findById.mockResolvedValue(null);
    await expect(categoryService.getById("cat_99")).rejects.toThrow(AppError);
  });

  it("getBySlug rejette si introuvable", async () => {
    mockedCacheGet.mockResolvedValue(null);
    mockedRepo.findBySlug.mockResolvedValue(null);
    await expect(categoryService.getBySlug("inconnu")).rejects.toThrow(
      AppError,
    );
  });
});

describe("categoryService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = { name: "Électronique", slug: "electronique" };

  it("rejette si le nom est déjà pris", async () => {
    mockedRepo.existsByName.mockResolvedValue(makeCategory() as any);
    await expect(categoryService.create(dto as any)).rejects.toThrow(
      "Category name already taken",
    );
  });

  it("rejette si le slug est déjà pris", async () => {
    mockedRepo.existsByName.mockResolvedValue(null);
    mockedRepo.existsBySlug.mockResolvedValue(makeCategory() as any);
    await expect(categoryService.create(dto as any)).rejects.toThrow(
      "Category slug already taken",
    );
  });

  it("rejette si la catégorie parente est introuvable", async () => {
    mockedRepo.existsByName.mockResolvedValue(null);
    mockedRepo.existsBySlug.mockResolvedValue(null);
    mockedRepo.findById.mockResolvedValue(null);

    await expect(
      categoryService.create({ ...dto, parentId: "cat_parent" } as any),
    ).rejects.toThrow("Parent category not found");
  });

  it("crée la catégorie et invalide le cache liste", async () => {
    mockedRepo.existsByName.mockResolvedValue(null);
    mockedRepo.existsBySlug.mockResolvedValue(null);
    mockedRepo.create.mockResolvedValue(makeCategory({ id: "cat_1" }) as any);

    const result = await categoryService.create(dto as any);

    expect(result.id).toBe("cat_1");
    expect(mockedCacheDel).toHaveBeenCalledWith("categories:all");
  });
});

describe("categoryService.update", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(
      categoryService.update("cat_99", { name: "X" } as any),
    ).rejects.toThrow(AppError);
  });

  it("rejette si on essaie de s'auto-désigner comme parent", async () => {
    mockedRepo.findById.mockResolvedValue(makeCategory({ id: "cat_1" }) as any);

    await expect(
      categoryService.update("cat_1", { parentId: "cat_1" } as any),
    ).rejects.toThrow("cannot be its own parent");
  });

  it("met à jour avec succès", async () => {
    mockedRepo.findById.mockResolvedValue(makeCategory({ id: "cat_1" }) as any);
    mockedRepo.update.mockResolvedValue(
      makeCategory({ id: "cat_1", name: "Renamed" }) as any,
    );

    const result = await categoryService.update("cat_1", {
      name: "Renamed",
    } as any);
    expect(result.name).toBe("Renamed");
  });
});

describe("categoryService.delete", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(categoryService.delete("cat_99")).rejects.toThrow(AppError);
  });

  it("rejette si des produits sont encore rattachés", async () => {
    mockedRepo.findById.mockResolvedValue(
      makeCategory({ _count: { products: 3 } }) as any,
    );

    await expect(categoryService.delete("cat_1")).rejects.toThrow(
      "Cannot delete category with 3 product(s) attached",
    );
  });

  it("supprime si aucun produit rattaché", async () => {
    mockedRepo.findById.mockResolvedValue(
      makeCategory({ _count: { products: 0 } }) as any,
    );

    const result = await categoryService.delete("cat_1");
    expect(result.message).toBe("Category deleted successfully");
  });
});
