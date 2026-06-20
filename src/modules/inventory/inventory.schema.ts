import { z } from "zod";

export const createInventorySchema = z.object({
  product_id: z.number().int().positive(),
  warehouse_id: z.string(),
  variant_id: z.string().optional(),
  quantity: z.number().int().min(0).default(0),
});

export const updateInventorySchema = z.object({
  quantity: z.number().int().min(0).optional(),
  warehouse_id: z.string().optional(),
});

export const transferInventorySchema = z.object({
  item_id: z.string(),
  from_warehouse: z.string(),
  to_warehouse: z.string(),
  quantity: z.number().int().positive(),
});

export type CreateInventoryDto = z.infer<typeof createInventorySchema>;
export type UpdateInventoryDto = z.infer<typeof updateInventorySchema>;
export type TransferInventoryDto = z.infer<typeof transferInventorySchema>;
