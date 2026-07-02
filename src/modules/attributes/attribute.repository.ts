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

  updateOption: (id: string, data: UpdateAttributeOptionDto) =>
    prisma.attributeOption.update({ where: { id }, data }),

  deleteOption: (id: string) =>
    prisma.attributeOption.delete({ where: { id } }),

  // ── Product attribute values ──────────────────────────────────────────────

  setProductAttributes: async (
    productId: number,
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
