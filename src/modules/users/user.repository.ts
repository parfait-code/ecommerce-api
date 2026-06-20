import { prisma } from "../../shared/config/database";
import { UpdateUserDto } from "./user.schema";
import { UserRole } from "@prisma/client";

export const userRepository = {
  findById: (id: number) =>
    prisma.user.findUnique({ where: { id, deletedAt: null } }),

  findAll: () => prisma.user.findMany({ where: { deletedAt: null } }),

  update: (
    id: number,
    data: Omit<UpdateUserDto, "dateOfBirth"> & { dateOfBirth?: Date },
  ) => prisma.user.update({ where: { id }, data }),

  changeRole: (id: number, role: UserRole) =>
    prisma.user.update({ where: { id }, data: { role } }),

  delete: (id: number) =>
    prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    }),
};
