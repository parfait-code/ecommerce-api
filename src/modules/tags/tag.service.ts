import { tagRepository } from "./tag.repository";
import { productRepository } from "../products/product.repository";
import { CreateTagDto, UpdateTagDto, SetProductTagsDto } from "./tag.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";

export const tagService = {
  getAll: () => tagRepository.findAll(),

  getById: async (id: string) => {
    const tag = await tagRepository.findById(id);
    if (!tag) throw new AppError("Tag not found", 404);
    return tag;
  },

  create: async (dto: CreateTagDto) => {
    const existingName = await tagRepository.findByName(dto.name);
    if (existingName) throw new AppError("Tag name already taken", 409);

    const existingSlug = await tagRepository.findBySlug(dto.slug);
    if (existingSlug) throw new AppError("Tag slug already taken", 409);

    return tagRepository.create(dto);
  },

  update: async (id: string, dto: UpdateTagDto) => {
    const tag = await tagRepository.findById(id);
    if (!tag) throw new AppError("Tag not found", 404);

    if (dto.name && dto.name !== tag.name) {
      const existing = await tagRepository.findByName(dto.name);
      if (existing) throw new AppError("Tag name already taken", 409);
    }

    if (dto.slug && dto.slug !== tag.slug) {
      const existing = await tagRepository.findBySlug(dto.slug);
      if (existing) throw new AppError("Tag slug already taken", 409);
    }

    return tagRepository.update(id, dto);
  },

  delete: async (id: string) => {
    const tag = await tagRepository.findById(id);
    if (!tag) throw new AppError("Tag not found", 404);
    await tagRepository.delete(id);
    return { message: "Tag deleted successfully" };
  },

  setProductTags: async (productId: number, dto: SetProductTagsDto) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    for (const tagId of dto.tagIds) {
      const tag = await tagRepository.findById(tagId);
      if (!tag) throw new AppError(`Tag ${tagId} not found`, 404);
    }

    const result = await tagRepository.setProductTags(productId, dto.tagIds);
    await cache.del(`products:${productId}`);
    return result;
  },

  getByProduct: async (productId: number) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError("Product not found", 404);
    return tagRepository.findByProduct(productId);
  },
};
