// tests/unit/tag.service.test.ts
import { tagService } from "../../src/modules/tags/tag.service";
import { tagRepository } from "../../src/modules/tags/tag.repository";
import { productRepository } from "../../src/modules/products/product.repository";
import { makeProduct } from "../mocks/factories";

jest.mock("../../src/modules/tags/tag.repository");
jest.mock("../../src/modules/products/product.repository");
jest.mock("../../src/shared/utils/cache", () => ({
  cache: { del: jest.fn() },
}));

const mockedRepo = tagRepository as jest.Mocked<typeof tagRepository>;
const mockedProductRepo = productRepository as jest.Mocked<
  typeof productRepository
>;

const makeTag = (overrides: Partial<any> = {}) => ({
  id: "tag_1",
  name: "Promo",
  slug: "promo",
  products: [],
  ...overrides,
});

describe("tagService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si le nom est déjà pris", async () => {
    mockedRepo.findByName.mockResolvedValue(makeTag() as any);
    await expect(
      tagService.create({ name: "Promo", slug: "promo" }),
    ).rejects.toThrow("Tag name already taken");
  });

  it("rejette si le slug est déjà pris", async () => {
    mockedRepo.findByName.mockResolvedValue(null);
    mockedRepo.findBySlug.mockResolvedValue(makeTag() as any);
    await expect(
      tagService.create({ name: "Nouveau", slug: "promo" }),
    ).rejects.toThrow("Tag slug already taken");
  });

  it("crée le tag", async () => {
    mockedRepo.findByName.mockResolvedValue(null);
    mockedRepo.findBySlug.mockResolvedValue(null);
    mockedRepo.create.mockResolvedValue(makeTag() as any);

    const result = await tagService.create({ name: "Promo", slug: "promo" });
    expect(result.id).toBe("tag_1");
  });
});

describe("tagService.setProductTags", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si le produit est introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(null);
    await expect(
      tagService.setProductTags(99, { tagIds: ["tag_1"] }),
    ).rejects.toThrow("Product not found");
  });

  it("rejette si un tag est introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findById.mockResolvedValue(null);

    await expect(
      tagService.setProductTags(1, { tagIds: ["tag_inexistant"] }),
    ).rejects.toThrow("not found");
  });

  it("assigne les tags au produit", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findById.mockResolvedValue(makeTag() as any);
    mockedRepo.setProductTags.mockResolvedValue({ id: 1, tags: [] } as any);

    await tagService.setProductTags(1, { tagIds: ["tag_1"] });
    expect(mockedRepo.setProductTags).toHaveBeenCalledWith(1, ["tag_1"]);
  });
});
