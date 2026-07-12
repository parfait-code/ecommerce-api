import { prisma } from "../../shared/config/database";

const wishlistInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          images: { select: { url: true }, take: 1 },
        },
      },
      combination: { select: { id: true, sku: true, price: true } },
    },
  },
};

export const wishlistRepository = {
  findByUserId: (userId: string) =>
    prisma.wishlist.findUnique({ where: { userId }, include: wishlistInclude }),

  create: (userId: string) =>
    prisma.wishlist.create({ data: { userId }, include: wishlistInclude }),

  addItem: async (
    wishlistId: string,
    productId: string,
    combinationId?: string,
  ) => {
    const cId = combinationId ?? null;
    const existing = await prisma.wishlistItem.findFirst({
      where: { wishlistId, productId, combinationId: cId },
    });
    if (existing) return existing;

    return prisma.wishlistItem.create({
      data: { wishlistId, productId, combinationId: cId },
    });
  },

  removeItem: (wishlistId: string, productId: string, combinationId?: string) =>
    prisma.wishlistItem.deleteMany({
      where: { wishlistId, productId, combinationId: combinationId ?? null },
    }),
};
