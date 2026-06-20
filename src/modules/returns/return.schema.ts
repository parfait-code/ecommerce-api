import { z } from "zod";
import { ReturnStatus } from "@prisma/client";

export const createReturnSchema = z.object({
  order_id: z.string(),
  reason: z.string().min(2),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        order_item_id: z.string(),
        quantity: z.number().int().positive(),
        condition: z.string().optional(),
      }),
    )
    .min(1),
});

export const updateReturnStatusSchema = z.object({
  status: z.nativeEnum(ReturnStatus),
  notes: z.string().optional(),
});

export type CreateReturnDto = z.infer<typeof createReturnSchema>;
export type UpdateReturnStatusDto = z.infer<typeof updateReturnStatusSchema>;
