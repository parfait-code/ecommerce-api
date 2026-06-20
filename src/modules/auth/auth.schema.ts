import { z } from "zod";
import { UserRole } from "@prisma/client";

export const signupSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  dateOfBirth: z.string().datetime().optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
});

export const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type SignupDto = z.infer<typeof signupSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
