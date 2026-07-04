import { loyaltyRepository } from "./loyalty.repository";
import { userRepository } from "../users/user.repository";
import { AdjustLoyaltyDto } from "./loyalty.schema";
import { AppError } from "../../shared/utils/app-error";

const POINTS_PER_XAF = 0.01; // 1 point par 100 XAF dépensés

export const loyaltyService = {
  getBalance: async (userId: number) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    const balance = await loyaltyRepository.getBalance(userId);
    return { userId, balance };
  },

  getHistory: async (userId: number) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    return loyaltyRepository.findByUser(userId);
  },

  earnFromOrder: async (
    userId: number,
    orderId: string,
    totalAmount: number,
  ) => {
    const points = Math.floor(totalAmount * POINTS_PER_XAF);
    if (points <= 0) return null;
    return loyaltyRepository.create({
      userId,
      orderId,
      points,
      type: "EARNED",
    });
  },

  // R4 — reversal des points gagnés sur une commande dont le retour est complété.
  // Idempotent : si un reversal a déjà été fait pour cette commande, ne rien refaire.
  reverseForOrder: async (userId: number, orderId: string) => {
    const transactions = await loyaltyRepository.findByOrder(orderId);

    const earned = transactions
      .filter((t) => t.type === "EARNED")
      .reduce((sum, t) => sum + t.points, 0);

    if (earned <= 0) return null;

    const alreadyReversed = transactions
      .filter((t) => t.type === "ADJUSTED" && t.points < 0)
      .reduce((sum, t) => sum + Math.abs(t.points), 0);

    const toReverse = earned - alreadyReversed;
    if (toReverse <= 0) return null;

    return loyaltyRepository.create({
      userId,
      orderId,
      points: -toReverse,
      type: "ADJUSTED",
    });
  },

  adjust: async (dto: AdjustLoyaltyDto) => {
    const user = await userRepository.findById(dto.userId);
    if (!user) throw new AppError("User not found", 404);

    if (dto.type === "REDEEMED") {
      const balance = await loyaltyRepository.getBalance(dto.userId);
      if (balance + dto.points < 0)
        throw new AppError("Insufficient loyalty points", 400);
    }

    return loyaltyRepository.create({
      userId: dto.userId,
      points: dto.points,
      type: dto.type,
      orderId: dto.orderId,
    });
  },
};
