import { z } from "zod";
import { normalizeCountry } from "../../shared/constants/countries";

// Une zone doit être un code ISO reconnu — normalisée à la volée pour
// garantir la même source de vérité que Address.country partout ailleurs.
const zoneCode = z
  .string()
  .length(2)
  .refine((value) => normalizeCountry(value) !== null, {
    message: "Zone must be a supported ISO 3166-1 alpha-2 country code",
  })
  .transform((value) => normalizeCountry(value)!);

export const createShippingMethodSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  estimatedDays: z.number().int().positive(),
  basePrice: z.number().min(0),
  pricePerKg: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
  zones: z.array(zoneCode).min(1),
});

export const updateShippingMethodSchema = createShippingMethodSchema.partial();

export const calculateShippingSchema = z.object({
  shippingMethodId: z.string(),
  weight: z.number().positive(),
  country: z.string().min(2),
});

export type CreateShippingMethodDto = z.infer<
  typeof createShippingMethodSchema
>;
export type UpdateShippingMethodDto = z.infer<
  typeof updateShippingMethodSchema
>;
export type CalculateShippingDto = z.infer<typeof calculateShippingSchema>;
