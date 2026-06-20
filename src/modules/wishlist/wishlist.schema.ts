import { z } from "zod";

export const addWishlistItemSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.string().optional(),
});

export const removeWishlistItemSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.string().optional(),
});

export type AddWishlistItemDto = z.infer<typeof addWishlistItemSchema>;
export type RemoveWishlistItemDto = z.infer<typeof removeWishlistItemSchema>;
