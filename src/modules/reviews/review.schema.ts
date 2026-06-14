import { z } from 'zod'

export const createReviewSchema = z.object({
  product_id: z.number().int().positive(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
})

export const updateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().optional(),
})

export type CreateReviewDto = z.infer<typeof createReviewSchema>
export type UpdateReviewDto = z.infer<typeof updateReviewSchema>