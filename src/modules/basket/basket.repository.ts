import { prisma } from "../../shared/config/database";

const basketInclude = {
  items: {
    include: {
      product: true,
      combination: {
        include: {
          values: {
            include: {
              attributeDefinition: {
                select: { id: true, name: true, slug: true },
              },
              attributeOption: {
                select: { id: true, value: true, colorHex: true },
              },
            },
          },
        },
      },
    },
  },
};

export const basketRepository = {
  create: (userId: string) =>
    prisma.basket.create({ data: { userId }, include: basketInclude }),

  findById: (id: string) =>
    prisma.basket.findUnique({ where: { id }, include: basketInclude }),

  findByUserId: (userId: string) =>
    prisma.basket.findUnique({ where: { userId }, include: basketInclude }),

  clearItems: (basketId: string) =>
    prisma.basketItem.deleteMany({ where: { basketId } }),

  addItem: async (
    basketId: string,
    productId: string,
    quantity: number,
    combinationId?: string,
  ) => {
    const cId = combinationId ?? null;
    const existing = await prisma.basketItem.findFirst({
      where: { basketId, productId, combinationId: cId },
    });

    if (existing) {
      return prisma.basketItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: quantity } },
      });
    }

    return prisma.basketItem.create({
      data: { basketId, productId, quantity, combinationId: cId },
    });
  },

  updateQuantity: (
    basketId: string,
    productId: string,
    quantity: number,
    combinationId?: string,
  ) => {
    const cId = combinationId ?? null;
    return prisma.basketItem.updateMany({
      where: { basketId, productId, combinationId: cId },
      data: { quantity },
    });
  },

  removeItem: (basketId: string, productId: string, combinationId?: string) => {
    const cId = combinationId ?? null;
    return prisma.basketItem.deleteMany({
      where: { basketId, productId, combinationId: cId },
    });
  },
};
