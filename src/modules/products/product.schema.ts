import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  category: z.string(),
  stock: z.number().int().min(0).default(0),
  images: z.array(z.string()).default([]),
})

export const updateProductSchema = createProductSchema.partial()

export type CreateProductDto = z.infer<typeof createProductSchema>
export type UpdateProductDto = z.infer<typeof updateProductSchema>