import { z } from "zod";

export const validateAddressSchema = z.object({
  street: z.string().min(2),
  city: z.string().min(2),
  state: z.string().optional(),
  country: z.string().min(2),
  postalCode: z.string().min(2),
});

export const createAddressSchema = z.object({
  street: z.string().min(2),
  city: z.string().min(2),
  state: z.string().optional(),
  country: z.string().min(2),
  postalCode: z.string().min(2),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export type ValidateAddressDto = z.infer<typeof validateAddressSchema>;
export type CreateAddressDto = z.infer<typeof createAddressSchema>;
export type UpdateAddressDto = z.infer<typeof updateAddressSchema>;
