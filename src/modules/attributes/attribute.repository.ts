import { prisma } from "../../shared/config/database";
import {
  CreateAttributeDefinitionDto,
  UpdateAttributeDefinitionDto,
  CreateAttributeOptionDto,
  UpdateAttributeOptionDto,
  SetProductAttributesDto,
} from "./attribute.schema";

const definitionInclude = {
  options: { orderBy: { position: "asc" as const } },
  category: { select: { id: true, name: true, slug: true } },
};

export const attributeRepository = {
  // ── Definitions ───────────────────────────────────────────────────────────

  findAllByCategory: (categoryId: string) =>
    prisma.attributeDefinition.findMany({
      where: { categoryId },
      include: definitionInclude,
      orderBy: { position: "asc" },
    }),

  findDefinitionById: (id: string) =>
    prisma.attributeDefinition.findUnique({
      where: { id },
      include: definitionInclude,
    }),

  findDefinitionBySlug: (categoryId: string, slug: string) =>
    prisma.attributeDefinition.findUnique({
      where: { categoryId_slug: { categoryId, slug } },
    }),
  findRequiredByCategory: (categoryId: string) =>
    prisma.attributeDefinition.findMany({
      where: { categoryId, isVariant: false, isRequired: true },
      select: { id: true, name: true, slug: true },
    }),

  createDefinition: (categoryId: string, data: CreateAttributeDefinitionDto) =>
    prisma.attributeDefinition.create({
      data: { categoryId, ...data },
      include: definitionInclude,
    }),

  updateDefinition: (id: string, data: UpdateAttributeDefinitionDto) =>
    prisma.attributeDefinition.update({
      where: { id },
      data,
      include: definitionInclude,
    }),

  deleteDefinition: (id: string) =>
    prisma.attributeDefinition.delete({ where: { id } }),

  // ── Options ───────────────────────────────────────────────────────────────

  createOption: (
    attributeDefinitionId: string,
    data: CreateAttributeOptionDto,
  ) =>
    prisma.attributeOption.create({ data: { attributeDefinitionId, ...data } }),

  findOptionById: (id: string) =>
    prisma.attributeOption.findUnique({ where: { id } }),

  // Nouveau — vérification d'unicité (attributeDefinitionId + value) explicite,
  // pour retourner un 409 propre au lieu de laisser remonter l'erreur Prisma P2002.
  findOptionByValue: (attributeDefinitionId: string, value: string) =>
    prisma.attributeOption.findUnique({
      where: { attributeDefinitionId_value: { attributeDefinitionId, value } },
    }),

  updateOption: (id: string, data: UpdateAttributeOptionDto) =>
    prisma.attributeOption.update({ where: { id }, data }),

  deleteOption: (id: string) =>
    prisma.attributeOption.delete({ where: { id } }),

  // Nouveau — détecte si une option est utilisée par au moins une combinaison
  // ayant encore du stock actif (quantity > 0), pour bloquer la suppression
  // dans ce cas au lieu de corrompre silencieusement la combinaison.
  findCombinationsWithStockUsingOption: (optionId: string) =>
    prisma.productCombinationValue.findMany({
      where: { attributeOptionId: optionId },
      include: {
        combination: {
          select: {
            id: true,
            optionsKey: true,
            inventory: { select: { quantity: true } },
          },
        },
      },
    }),

  // ── Product attribute values ──────────────────────────────────────────────

  setProductAttributes: async (
    productId: string,
    dto: SetProductAttributesDto,
  ) => {
    return prisma.$transaction(async (tx) => {
      await tx.productAttributeValue.deleteMany({ where: { productId } });
      await tx.productAttributeValue.createMany({
        data: dto.attributes.map((a) => ({
          productId,
          attributeDefinitionId: a.attributeDefinitionId,
          value: a.value,
        })),
      });
      return tx.productAttributeValue.findMany({
        where: { productId },
        include: { attributeDefinition: true },
      });
    });
  },
};
