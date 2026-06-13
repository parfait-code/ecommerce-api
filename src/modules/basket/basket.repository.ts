import { prisma } from '../../shared/config/database'

const basketInclude = {
  items: {
    include: { product: true },
  },
}

export const basketRepository = {
  create: (userId: number) =>
    prisma.basket.create({
      data: { userId },
      include: basketInclude,
    }),

  findById: (id: string) =>
    prisma.basket.findUnique({
      where: { id },
      include: basketInclude,
    }),

  addItem: (basketId: string, productId: number, quantity: number) =>
    prisma.basketItem.upsert({
      where: { basketId_productId: { basketId, productId } },
      create: { basketId, productId, quantity },
      update: { quantity: { increment: quantity } },
    }),

  updateQuantity: (basketId: string, productId: number, quantity: number) =>
    prisma.basketItem.update({
      where: { basketId_productId: { basketId, productId } },
      data: { quantity },
    }),

  removeItem: (basketId: string, productId: number) =>
    prisma.basketItem.delete({
      where: { basketId_productId: { basketId, productId } },
    }),
}