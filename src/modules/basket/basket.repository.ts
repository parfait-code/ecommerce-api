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
    const vId = variantId ?? null;
    return prisma.basketItem.upsert({
      where: {
        basketId_productId_variantId: { basketId, productId, variantId: vId },
      },
      create: { basketId, productId, quantity, variantId: vId },
      update: { quantity: { increment: quantity } },
    });
  },

  updateQuantity: (
    basketId: string,
    productId: number,
    quantity: number,
    variantId?: string,
  ) => {
    const vId = variantId ?? null;
    return prisma.basketItem.updateMany({
      where: { basketId, productId, variantId: vId },
      data: { quantity },
    });
  },

  removeItem: (basketId: string, productId: number, variantId?: string) => {
    const vId = variantId ?? null;
    return prisma.basketItem.deleteMany({
      where: { basketId, productId, variantId: vId },
    });
  },
};
