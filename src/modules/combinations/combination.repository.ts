import { prisma } from "../../shared/config/database";
import { UpdateCombinationDto } from "./combination.schema";

const combinationInclude = {
  values: {
    include: {
      attributeDefinition: { select: { id: true, name: true, slug: true } },
      attributeOption: { select: { id: true, value: true, colorHex: true } },
    },
  },
  inventory: { select: { id: true, quantity: true, warehouseId: true } },
  images: { orderBy: { position: "asc" as const } },
};

export const combinationRepository = {
  findByProduct: (productId: number) =>
    prisma.productCombination.findMany({
      where: { productId },
      include: combinationInclude,
      orderBy: { createdAt: "asc" },
    }),

  findById: (id: string) =>
    prisma.productCombination.findUnique({
      where: { id },
      include: combinationInclude,
    }),

  findBySku: (sku: string) =>
    prisma.productCombination.findUnique({ where: { sku } }),

  findByOptionsKey: (productId: number, optionsKey: string) =>
    prisma.productCombination.findUnique({
      where: { productId_optionsKey: { productId, optionsKey } },
      include: combinationInclude,
    }),

  // Nouveau — utilisé par combination.service.ts::generate() pour détecter,
  // AVANT désactivation, quelles combinaisons sur le point d'être désactivées
  // ont encore du stock actif (S3).
  findActiveExcept: (productId: number, keepOptionsKeys: string[]) =>
    prisma.productCombination.findMany({
      where: {
        productId,
        isActive: true,
        optionsKey: { notIn: keepOptionsKeys },
      },
      include: {
        inventory: { select: { id: true, quantity: true, warehouseId: true } },
      },
    }),

  create: (
    productId: number,
    optionsKey: string,
    values: { attributeDefinitionId: string; attributeOptionId: string }[],
  ) =>
    prisma.productCombination.create({
      data: { productId, optionsKey, values: { create: values } },
      include: combinationInclude,
    }),

  update: (id: string, data: UpdateCombinationDto) =>
    prisma.productCombination.update({
      where: { id },
      data,
      include: combinationInclude,
    }),

  deactivateManyExcept: (productId: number, keepOptionsKeys: string[]) =>
    prisma.productCombination.updateMany({
      where: { productId, optionsKey: { notIn: keepOptionsKeys } },
      data: { isActive: false },
    }),

  delete: (id: string) => prisma.productCombination.delete({ where: { id } }),
};
