import { z } from "zod";
import { ProductStatus } from "@prisma/client";

export const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  categoryId: z.string(),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.DRAFT),
  weight: z.number().positive(), // désormais obligatoire
});

export const updateProductSchema = createProductSchema.partial();

export const uploadImagesSchema = z.object({
  variantId: z.string().optional(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type UploadImagesDto = z.infer<typeof uploadImagesSchema>;
