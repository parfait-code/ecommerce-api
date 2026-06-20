import { prisma } from "../../shared/config/database";

const basketInclude = {
  items: {
    include: {
      product: true,
      variant: {
        include: {
          attributeValues: {
            include: {
              attributeDefinition: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      },
    },
  },
};

export const basketRepository = {
  create: (userId: number) =>
    prisma.basket.create({ data: { userId }, include: basketInclude }),

  findById: (id: string) =>
    prisma.basket.findUnique({ where: { id }, include: basketInclude }),

  addItem: (
    basketId: string,
    productId: number,
    quantity: number,
    variantId?: string,
  ) => {
    if (variantId) {
      return prisma.basketItem.upsert({
        where: {
          basketId_productId_variantId: { basketId, productId, variantId },
        },
        create: { basketId, productId, quantity, variantId },
        update: { quantity: { increment: quantity } },
      });
    }
    return prisma.basketItem.upsert({
      where: {
        basketId_productId_variantId: { basketId, productId, variantId: "" },
      },
      create: { basketId, productId, quantity },
      update: { quantity: { increment: quantity } },
    });
  },

  updateQuantity: (
    basketId: string,
    productId: number,
    quantity: number,
    variantId?: string,
  ) => {
    if (variantId) {
      return prisma.basketItem.update({
        where: {
          basketId_productId_variantId: { basketId, productId, variantId },
        },
        data: { quantity },
      });
    }
    return prisma.basketItem.updateMany({
      where: { basketId, productId, variantId: null },
      data: { quantity },
    });
  },

  removeItem: (basketId: string, productId: number, variantId?: string) => {
    if (variantId) {
      return prisma.basketItem.delete({
        where: {
          basketId_productId_variantId: { basketId, productId, variantId },
        },
      });
    }
    return prisma.basketItem.deleteMany({
      where: { basketId, productId, variantId: null },
    });
  },
};
