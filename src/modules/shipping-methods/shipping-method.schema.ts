import { z } from "zod";

export const createShippingMethodSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  estimatedDays: z.number().int().positive(),
  basePrice: z.number().min(0),
  pricePerKg: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
  zones: z.array(z.string().length(2)).min(1),
});

export const updateShippingMethodSchema = createShippingMethodSchema.partial();

export const calculateShippingSchema = z.object({
  shippingMethodId: z.string(),
  weight: z.number().positive(),
});

export type CreateShippingMethodDto = z.infer<
  typeof createShippingMethodSchema
>;
export type UpdateShippingMethodDto = z.infer<
  typeof updateShippingMethodSchema
>;
export type CalculateShippingDto = z.infer<typeof calculateShippingSchema>;
