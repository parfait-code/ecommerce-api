import { z } from 'zod'

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  age: z.number().int().positive().optional(),
})

export const changeRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
})

export type UpdateUserDto = z.infer<typeof updateUserSchema>
export type ChangeRoleDto = z.infer<typeof changeRoleSchema>