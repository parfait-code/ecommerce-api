import { z } from "zod";
import { UserRole } from "@prisma/client";

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  dateOfBirth: z.string().datetime().optional(),
  phone: z.string().optional(),
});

export const changeRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const adminCreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  dateOfBirth: z.string().datetime().optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type ChangeRoleDto = z.infer<typeof changeRoleSchema>;
export type AdminCreateUserDto = z.infer<typeof adminCreateUserSchema>;
