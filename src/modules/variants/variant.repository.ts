import { prisma } from "../../shared/config/database";
import { CreateVariantDto, UpdateVariantDto } from "./variant.schema";

const variantInclude = {
  attributeValues: {
    include: {
      attributeDefinition: {
        select: { id: true, name: true, slug: true, type: true },
      },
    },
  },
  inventory: { select: { id: true, quantity: true, warehouseId: true } },
  images: { orderBy: { position: "asc" as const } },
};

export const variantRepository = {
  findById: (id: string) =>
    prisma.productVariant.findUnique({
      where: { id },
      include: variantInclude,
    }),

  findByProduct: (productId: number) =>
    prisma.productVariant.findMany({
      where: { productId },
      include: variantInclude,
      orderBy: { createdAt: "asc" },
    }),

  findBySku: (sku: string) =>
    prisma.productVariant.findUnique({ where: { sku } }),

  create: async (productId: number, dto: CreateVariantDto) => {
    return prisma.productVariant.create({
      data: {
        productId,
        sku: dto.sku,
        price: dto.price ?? null,
        isActive: dto.isActive,
        attributeValues: {
          create: dto.attributes.map((a) => ({
            attributeDefinitionId: a.attributeDefinitionId,
            value: a.value,
          })),
        },
      },
      include: variantInclude,
    });
  },

  update: async (id: string, dto: UpdateVariantDto) => {
    return prisma.$transaction(async (tx) => {
      if (dto.attributes) {
        await tx.variantAttributeValue.deleteMany({ where: { variantId: id } });
        await tx.variantAttributeValue.createMany({
          data: dto.attributes.map((a) => ({
            variantId: id,
            attributeDefinitionId: a.attributeDefinitionId,
            value: a.value,
          })),
        });
      }

      return tx.productVariant.update({
        where: { id },
        data: {
          ...(dto.sku !== undefined && { sku: dto.sku }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        include: variantInclude,
      });
    });
  },

  delete: (id: string) => prisma.productVariant.delete({ where: { id } }),
};
