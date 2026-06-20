import { z } from "zod";

export const createVariantSchema = z.object({
  sku: z.string().min(1).max(100),
  price: z.number().positive().optional(),
  isActive: z.boolean().default(true),
  attributes: z
    .array(
      z.object({
        attributeDefinitionId: z.string(),
        value: z.string(),
      }),
    )
    .min(1),
});

export const updateVariantSchema = z.object({
  sku: z.string().min(1).max(100).optional(),
  price: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  attributes: z
    .array(
      z.object({
        attributeDefinitionId: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
});

export type CreateVariantDto = z.infer<typeof createVariantSchema>;
export type UpdateVariantDto = z.infer<typeof updateVariantSchema>;
