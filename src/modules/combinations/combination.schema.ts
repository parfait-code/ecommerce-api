import { z } from "zod";

export const setVariantOptionsSchema = z.object({
  optionIds: z.array(z.string()),
});

export const updateCombinationSchema = z.object({
  sku: z.string().min(1).max(100).optional(),
  price: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export type SetVariantOptionsDto = z.infer<typeof setVariantOptionsSchema>;
export type UpdateCombinationDto = z.infer<typeof updateCombinationSchema>;
