import { z } from 'zod'

export const createWarehouseSchema = z.object({
  name: z.string().min(2).max(100),
  location: z.string(),
  capacity: z.number().int().positive().optional(),
})

export const updateWarehouseSchema = createWarehouseSchema.partial()

export type CreateWarehouseDto = z.infer<typeof createWarehouseSchema>
export type UpdateWarehouseDto = z.infer<typeof updateWarehouseSchema>