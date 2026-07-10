import { z } from "zod";
import { addressFieldsSchema } from "../../shared/schemas/address.schema";

export const validateAddressSchema = addressFieldsSchema;

export const createAddressSchema = addressFieldsSchema.extend({
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export type ValidateAddressDto = z.infer<typeof validateAddressSchema>;
export type CreateAddressDto = z.infer<typeof createAddressSchema>;
export type UpdateAddressDto = z.infer<typeof updateAddressSchema>;
