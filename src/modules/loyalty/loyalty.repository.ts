import { prisma } from "../../shared/config/database";
import { LoyaltyEventType } from "@prisma/client";

export const loyaltyRepository = {
  findByUser: (userId: string) =>
    prisma.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),

  // Nouveau — utilisé par loyaltyService.reverseForOrder (R4)
  findByOrder: (orderId: string) =>
    prisma.loyaltyTransaction.findMany({
      where: { orderId },
    }),

  getBalance: async (userId: string): Promise<number> => {
    const result = await prisma.loyaltyTransaction.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    return result._sum.points ?? 0;
  },

  create: (data: {
    userId: string;
    points: number;
    type: LoyaltyEventType;
    orderId?: string;
  }) => prisma.loyaltyTransaction.create({ data }),
};