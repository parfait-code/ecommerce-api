import { z } from "zod";
import { LoyaltyEventType } from "@prisma/client";

export const adjustLoyaltySchema = z.object({
  userId: z.string(),
  points: z
    .number()
    .int()
    .refine((v) => v !== 0, { message: "Points cannot be zero" }),
  type: z.nativeEnum(LoyaltyEventType),
  orderId: z.string().optional(),
});

export type AdjustLoyaltyDto = z.infer<typeof adjustLoyaltySchema>;