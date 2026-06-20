import { z } from "zod";
import { AttributeType } from "@prisma/client";

export const createAttributeDefinitionSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug must be lowercase, alphanumeric and hyphen-separated",
    }),
  type: z.nativeEnum(AttributeType),
  unit: z.string().optional(),
  isVariant: z.boolean().default(false),
  isFilterable: z.boolean().default(true),
  isRequired: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
});

export const updateAttributeDefinitionSchema =
  createAttributeDefinitionSchema.partial();

export const createAttributeOptionSchema = z.object({
  value: z.string().min(1),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  position: z.number().int().min(0).default(0),
});

export const setProductAttributesSchema = z.object({
  attributes: z.array(
    z.object({
      attributeDefinitionId: z.string(),
      value: z.string(),
    }),
  ),
});

export type CreateAttributeDefinitionDto = z.infer<
  typeof createAttributeDefinitionSchema
>;
export type UpdateAttributeDefinitionDto = z.infer<
  typeof updateAttributeDefinitionSchema
>;
export type CreateAttributeOptionDto = z.infer<
  typeof createAttributeOptionSchema
>;
export type SetProductAttributesDto = z.infer<
  typeof setProductAttributesSchema
>;
