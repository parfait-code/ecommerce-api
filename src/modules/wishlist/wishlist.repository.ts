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

  addItem: (wishlistId: string, productId: number, variantId?: string) =>
    prisma.wishlistItem.upsert({
      where: {
        wishlistId_productId_variantId: {
          wishlistId,
          productId,
          variantId: variantId ?? null,
        },
      },
      create: { wishlistId, productId, variantId: variantId ?? null },
      update: {},
    }),

  removeItem: (wishlistId: string, productId: number, variantId?: string) =>
    prisma.wishlistItem.deleteMany({
      where: { wishlistId, productId, variantId: variantId ?? null },
    }),
};
