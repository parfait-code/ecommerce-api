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
      variant: { select: { id: true, sku: true, price: true } },
    },
  },
};

export const wishlistRepository = {
  findByUserId: (userId: number) =>
    prisma.wishlist.findUnique({
      where: { userId },
      include: wishlistInclude,
    }),

  create: (userId: number) =>
    prisma.wishlist.create({ data: { userId }, include: wishlistInclude }),

  addItem: async (
    wishlistId: string,
    productId: number,
    variantId?: string,
  ) => {
    const vId = variantId ?? null;
    const existing = await prisma.wishlistItem.findFirst({
      where: { wishlistId, productId, variantId: vId },
    });

    if (existing) return existing;

    return prisma.wishlistItem.create({
      data: { wishlistId, productId, variantId: vId },
    });
  },

  removeItem: (wishlistId: string, productId: number, variantId?: string) =>
    prisma.wishlistItem.deleteMany({
      where: { wishlistId, productId, variantId: variantId ?? null },
    }),
};
