import { combinationRepository } from "./combination.repository";
import { productRepository } from "../products/product.repository";
import { attributeRepository } from "../attributes/attribute.repository";
import { prisma } from "../../shared/config/database";
import {
  SetVariantOptionsDto,
  UpdateCombinationDto,
} from "./combination.schema";
import { AppError } from "../../shared/utils/app-error";
import { cache } from "../../shared/utils/cache";
import { eventBus } from "../../shared/events/event-bus";
import { businessLogger } from "../../shared/logger";

const buildOptionsKey = (optionIds: string[]) =>
  [...optionIds].sort().join(":");

export const combinationService = {
  setOptionsForAttribute: async (
    productId: number,
    attributeDefinitionId: string,
    dto: SetVariantOptionsDto,
  ) => {
    const product = await productRepository.findById(productId, true);
    if (!product) throw new AppError("Product not found", 404);

    const definition = await attributeRepository.findDefinitionById(
      attributeDefinitionId,
    );
    if (!definition) throw new AppError("Attribute definition not found", 404);
    if (definition.categoryId !== product.categoryId)
      throw new AppError(
        "Attribute does not belong to this product's category",
        400,
      );
    if (!definition.isVariant)
      throw new AppError(
        "This attribute is not a variant attribute — use PUT /product/:productId/attributes instead",
        400,
      );

    const validOptionIds = new Set(definition.options.map((o) => o.id));
    for (const optionId of dto.optionIds) {
      if (!validOptionIds.has(optionId))
        throw new AppError(
          `Option ${optionId} does not belong to this attribute`,
          400,
        );
    }

    await prisma.$transaction([
      prisma.productAttributeSelection.deleteMany({
        where: { productId, attributeDefinitionId },
      }),
      prisma.productAttributeSelection.createMany({
        data: dto.optionIds.map((attributeOptionId) => ({
          productId,
          attributeDefinitionId,
          attributeOptionId,
        })),
      }),
    ]);

    return prisma.productAttributeSelection.findMany({
      where: { productId, attributeDefinitionId },
      include: { attributeOption: true },
    });
  },

  getSelections: async (productId: number) => {
    const product = await productRepository.findById(productId, true);
    if (!product) throw new AppError("Product not found", 404);

    return prisma.productAttributeSelection.findMany({
      where: { productId },
      include: {
        attributeDefinition: { select: { id: true, name: true, slug: true } },
        attributeOption: true,
      },
    });
  },

  generate: async (productId: number) => {
    const product = await productRepository.findById(productId, true);
    if (!product) throw new AppError("Product not found", 404);

    const selections = await prisma.productAttributeSelection.findMany({
      where: { productId },
    });

    if (selections.length === 0)
      throw new AppError(
        "No variant attribute options selected for this product yet",
        400,
      );

    const byAttribute = new Map<string, string[]>();
    for (const s of selections) {
      const list = byAttribute.get(s.attributeDefinitionId) ?? [];
      list.push(s.attributeOptionId);
      byAttribute.set(s.attributeDefinitionId, list);
    }

    let combos: {
      attributeDefinitionId: string;
      attributeOptionId: string;
    }[][] = [[]];
    for (const [attributeDefinitionId, optionIds] of byAttribute) {
      const next: typeof combos = [];
      for (const combo of combos) {
        for (const attributeOptionId of optionIds) {
          next.push([...combo, { attributeDefinitionId, attributeOptionId }]);
        }
      }
      combos = next;
    }

    const generatedKeys: string[] = [];

    for (const combo of combos) {
      const optionsKey = buildOptionsKey(combo.map((c) => c.attributeOptionId));
      generatedKeys.push(optionsKey);

      const existing = await combinationRepository.findByOptionsKey(
        productId,
        optionsKey,
      );
      if (existing) {
        if (!existing.isActive)
          await combinationRepository.update(existing.id, { isActive: true });
        continue;
      }
      await combinationRepository.create(productId, optionsKey, combo);
    }

    // S3 — avant de désactiver, on identifie celles qui ont encore du stock
    // actif pour émettre un avertissement (la désactivation elle-même n'est
    // PAS bloquée, comme documenté dans le guide).
    const toDeactivate = await combinationRepository.findActiveExcept(
      productId,
      generatedKeys,
    );

    for (const combo of toDeactivate) {
      const totalQuantity = combo.inventory.reduce(
        (sum, i) => sum + i.quantity,
        0,
      );
      if (totalQuantity > 0) {
        eventBus.emit("combination.deactivated", {
          productId,
          combinationId: combo.id,
          optionsKey: combo.optionsKey,
          hadStock: true,
          totalQuantity,
        });
      }
    }

    // Désactive (ne supprime pas) les combinaisons qui ne correspondent plus à la sélection actuelle
    await combinationRepository.deactivateManyExcept(productId, generatedKeys);

    await cache.del(`products:${productId}`);

    return combinationRepository.findByProduct(productId);
  },

  getByProduct: async (productId: number, includeInactive = false) => {
    const product = await productRepository.findById(
      productId,
      includeInactive,
    );
    if (!product) throw new AppError("Product not found", 404);
    return combinationRepository.findByProduct(productId);
  },

  getById: async (id: string) => {
    const combination = await combinationRepository.findById(id);
    if (!combination) throw new AppError("Combination not found", 404);
    return combination;
  },

  update: async (id: string, productId: number, dto: UpdateCombinationDto) => {
    const combination = await combinationRepository.findById(id);
    if (!combination) throw new AppError("Combination not found", 404);
    if (combination.productId !== productId)
      throw new AppError("Combination not found on this product", 404);

    if (dto.sku) {
      const existingSku = await combinationRepository.findBySku(dto.sku);
      if (existingSku && existingSku.id !== id)
        throw new AppError("SKU already taken", 409);
    }

    const updated = await combinationRepository.update(id, dto);
    await cache.del(`products:${productId}`);

    // S3 — même avertissement pour la désactivation manuelle via PATCH.
    if (dto.isActive === false) {
      const totalQuantity = combination.inventory.reduce(
        (sum, i) => sum + i.quantity,
        0,
      );
      if (totalQuantity > 0) {
        eventBus.emit("combination.deactivated", {
          productId,
          combinationId: id,
          optionsKey: combination.optionsKey,
          hadStock: true,
          totalQuantity,
        });
      }
    }

    return updated;
  },

  delete: async (id: string, productId: number) => {
    const combination = await combinationRepository.findById(id);
    if (!combination) throw new AppError("Combination not found", 404);
    if (combination.productId !== productId)
      throw new AppError("Combination not found on this product", 404);

    const totalQuantity = combination.inventory.reduce(
      (sum, i) => sum + i.quantity,
      0,
    );
    if (totalQuantity > 0)
      throw new AppError(
        `Cannot delete a combination that still has ${totalQuantity} unit(s) in stock — remove stock first`,
        400,
      );

    const affectedBasketItems = await prisma.basketItem.findMany({
      where: { combinationId: id },
      select: { basketId: true },
    });

    if (affectedBasketItems.length > 0) {
      await prisma.basketItem.deleteMany({ where: { combinationId: id } });

      businessLogger.log("ITEM_REMOVED", {
        service: "combinations",
        actor: { userId: null, role: "ADMIN" },
        target: { productId, combinationId: id } as any,
        metadata: {
          reason: "Combination deleted",
          removedCount: affectedBasketItems.length,
          basketIds: affectedBasketItems.map((b) => b.basketId),
        },
      });
    }

    await combinationRepository.delete(id);
    await cache.del(`products:${productId}`);
    return { message: "Combination deleted successfully" };
  },
};
