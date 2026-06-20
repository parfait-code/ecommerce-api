import { variantRepository } from "./variant.repository";
import { productRepository } from "../products/product.repository";
import { attributeRepository } from "../attributes/attribute.repository";
import { CreateVariantDto, UpdateVariantDto } from "./variant.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";

export const variantService = {
  getByProduct: async (productId: number) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError("Product not found", 404);
    return variantRepository.findByProduct(productId);
  },

  getById: async (id: string) => {
    const variant = await variantRepository.findById(id);
    if (!variant) throw new AppError("Variant not found", 404);
    return variant;
  },

  create: async (productId: number, dto: CreateVariantDto) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    const existingSku = await variantRepository.findBySku(dto.sku);
    if (existingSku) throw new AppError("SKU already taken", 409);

    // Valider que les attributeDefinitionId appartiennent à la catégorie du produit
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
          `Attribute ${definition.name} does not belong to category ${product.categoryId}`,
          400,
        );
      if (!definition.isVariant)
        throw new AppError(
          `Attribute ${definition.name} is not a variant attribute`,
          400,
        );
    }

    const variant = await variantRepository.create(productId, dto);
    await cache.del(`products:${productId}`);
    return variant;
  },

  update: async (id: string, productId: number, dto: UpdateVariantDto) => {
    const variant = await variantRepository.findById(id);
    if (!variant) throw new AppError("Variant not found", 404);
    if (variant.productId !== productId)
      throw new AppError("Variant not found on this product", 404);

    if (dto.sku && dto.sku !== variant.sku) {
      const existingSku = await variantRepository.findBySku(dto.sku);
      if (existingSku) throw new AppError("SKU already taken", 409);
    }

    const updated = await variantRepository.update(id, dto);
    await cache.del(`products:${productId}`);
    return updated;
  },

  delete: async (id: string, productId: number) => {
    const variant = await variantRepository.findById(id);
    if (!variant) throw new AppError("Variant not found", 404);
    if (variant.productId !== productId)
      throw new AppError("Variant not found on this product", 404);

    await variantRepository.delete(id);
    await cache.del(`products:${productId}`);
    return { message: "Variant deleted successfully" };
  },
};
