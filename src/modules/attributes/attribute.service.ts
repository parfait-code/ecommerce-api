import { attributeRepository } from "./attribute.repository";
import { categoryRepository } from "../categories/category.repository";
import { productRepository } from "../products/product.repository";
import {
  CreateAttributeDefinitionDto,
  UpdateAttributeDefinitionDto,
  CreateAttributeOptionDto,
  UpdateAttributeOptionDto,
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

    const existing = await attributeRepository.findOptionByValue(
      definitionId,
      dto.value,
    );
    if (existing)
      throw new AppError(
        "An option with this value already exists for this attribute",
        409,
      );

    return attributeRepository.createOption(definitionId, dto);
  },

  updateOption: async (optionId: string, dto: UpdateAttributeOptionDto) => {
    const option = await attributeRepository.findOptionById(optionId);
    if (!option) throw new AppError("Option not found", 404);

    // Corrigé — vérification explicite d'unicité (attributeDefinitionId + value)
    // avant l'update, pour retourner un 409 propre plutôt que de laisser
    // remonter l'erreur Prisma P2002 brute en 500.
    if (dto.value && dto.value !== option.value) {
      const existing = await attributeRepository.findOptionByValue(
        option.attributeDefinitionId,
        dto.value,
      );
      if (existing && existing.id !== optionId)
        throw new AppError(
          "An option with this value already exists for this attribute",
          409,
        );
    }

    return attributeRepository.updateOption(optionId, dto);
  },

  deleteOption: async (optionId: string) => {
    // Corrigé — l'existence de l'option est désormais vérifiée avant la
    // suppression (comme deleteDefinition), au lieu de laisser Prisma
    // remonter une erreur brute (500) sur un ID invalide.
    const option = await attributeRepository.findOptionById(optionId);
    if (!option) throw new AppError("Option not found", 404);

    // Corrigé — intégrité des données : une option supprimée cascade la
    // suppression de ProductCombinationValue (onDelete: Cascade), ce qui
    // corromprait silencieusement toute combinaison utilisant cette option
    // si elle a encore du stock actif (elle perdrait sa valeur d'attribut
    // tout en gardant son stock/historique de commandes). On applique le
    // même garde-fou que pour la suppression directe d'une combinaison.
    const usages =
      await attributeRepository.findCombinationsWithStockUsingOption(optionId);
    const withStock = usages.filter(
      (u) =>
        u.combination.inventory.reduce((sum, i) => sum + i.quantity, 0) > 0,
    );

    if (withStock.length > 0) {
      throw new AppError(
        `Cannot delete option: it is used by ${withStock.length} combination(s) that still have stock — remove stock from those combinations first`,
        400,
      );
    }

    await attributeRepository.deleteOption(optionId);
    return { message: "Option deleted successfully" };
  },

  // ── Product attribute values ──────────────────────────────────────────────

  setProductAttributes: async (
    productId: string,
    dto: SetProductAttributesDto,
  ) => {
    const product = await productRepository.findById(productId, true);
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
      if (definition.isVariant)
        throw new AppError(
          `Attribute ${definition.name} is a variant attribute — use PUT /product/:productId/combinations/selections/:attributeDefinitionId instead`,
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
