import { attributeRepository } from "./attribute.repository";
import { categoryRepository } from "../categories/category.repository";
import { productRepository } from "../products/product.repository";
import {
  CreateAttributeDefinitionDto,
  UpdateAttributeDefinitionDto,
  CreateAttributeOptionDto,
  SetProductAttributesDto,
} from "./attribute.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";

export const attributeService = {
  // ── Definitions ───────────────────────────────────────────────────────────

  getByCategory: async (categoryId: string) => {
    const category = await categoryRepository.findById(categoryId);
    if (!category) throw new AppError("Category not found", 404);
    return attributeRepository.findAllByCategory(categoryId);
  },

  getDefinitionById: async (id: string) => {
    const definition = await attributeRepository.findDefinitionById(id);
    if (!definition) throw new AppError("Attribute definition not found", 404);
    return definition;
  },

  createDefinition: async (
    categoryId: string,
    dto: CreateAttributeDefinitionDto,
  ) => {
    const category = await categoryRepository.findById(categoryId);
    if (!category) throw new AppError("Category not found", 404);

    const existing = await attributeRepository.findDefinitionBySlug(
      categoryId,
      dto.slug,
    );
    if (existing)
      throw new AppError("Attribute slug already exists in this category", 409);

    return attributeRepository.createDefinition(categoryId, dto);
  },

  updateDefinition: async (id: string, dto: UpdateAttributeDefinitionDto) => {
    const definition = await attributeRepository.findDefinitionById(id);
    if (!definition) throw new AppError("Attribute definition not found", 404);

    if (dto.slug && dto.slug !== definition.slug) {
      const existing = await attributeRepository.findDefinitionBySlug(
        definition.categoryId,
        dto.slug,
      );
      if (existing)
        throw new AppError(
          "Attribute slug already exists in this category",
          409,
        );
    }

    return attributeRepository.updateDefinition(id, dto);
  },

  deleteDefinition: async (id: string) => {
    const definition = await attributeRepository.findDefinitionById(id);
    if (!definition) throw new AppError("Attribute definition not found", 404);
    await attributeRepository.deleteDefinition(id);
    return { message: "Attribute definition deleted successfully" };
  },

  // ── Options ───────────────────────────────────────────────────────────────

  createOption: async (definitionId: string, dto: CreateAttributeOptionDto) => {
    const definition =
      await attributeRepository.findDefinitionById(definitionId);
    if (!definition) throw new AppError("Attribute definition not found", 404);
    return attributeRepository.createOption(definitionId, dto);
  },

  deleteOption: async (optionId: string) => {
    await attributeRepository.deleteOption(optionId);
    return { message: "Option deleted successfully" };
  },

  // ── Product attribute values ──────────────────────────────────────────────

  setProductAttributes: async (
    productId: number,
    dto: SetProductAttributesDto,
  ) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    for (const attr of dto.attributes) {
      const definition = await attributeRepository.findDefinitionById(
        attr.attributeDefinitionId,
      );
      if (!definition)
        throw new AppError(
          `Attribute definition ${attr.attributeDefinitionId} not found`,
          404,
        );
      if (definition.categoryId !== product.categoryId)
        throw new AppError(
          `Attribute ${definition.name} does not belong to this product's category`,
          400,
        );
    }

    const result = await attributeRepository.setProductAttributes(
      productId,
      dto,
    );
    await cache.del(`products:${productId}`);
    return result;
  },
};
