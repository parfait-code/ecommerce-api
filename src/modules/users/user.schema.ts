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

// NOUVEAU
export const adminCreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  age: z.number().int().positive(),
  role: z.string().default('user'),
})

export type UpdateUserDto = z.infer<typeof updateUserSchema>
export type ChangeRoleDto = z.infer<typeof changeRoleSchema>
export type AdminCreateUserDto = z.infer<typeof adminCreateUserSchema>