import { prisma } from "../../shared/config/database";
import { UserRole } from "@prisma/client";

export const authRepository = {
  findByUsername: (username: string) =>
    prisma.user.findUnique({ where: { username } }),

  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  createUser: (data: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: Date | null;
    phone?: string | null;
    role: UserRole;
  }) => prisma.user.create({ data }),
};
