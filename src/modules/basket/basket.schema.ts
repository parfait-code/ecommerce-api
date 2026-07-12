import { z } from "zod";

export const addProductSchema = z.object({
  product_id: z.string(),
  combination_id: z.string().optional(),
  quantity: z.number().int().positive(),
});

export const updateQuantitySchema = z.object({
  product_id: z.string(),
  combination_id: z.string().optional(),
  quantity: z.number().int().positive(),
});

export const removeProductSchema = z.object({
  product_id: z.string(),
  combination_id: z.string().optional(),
});

export type AddProductDto = z.infer<typeof addProductSchema>;
export type UpdateQuantityDto = z.infer<typeof updateQuantitySchema>;
export type RemoveProductDto = z.infer<typeof removeProductSchema>;