import { prisma } from "../../shared/config/database";
import { AppError } from "../../shared/utils/app-error";
import { UpdateUserDto } from "./user.schema";
import { UserRole } from "@prisma/client";

export const userRepository = {
  findById: (id: string) => {
    if (!id) {
      throw new AppError("A valid user id is required", 400);
    }
    return prisma.user.findUnique({ where: { id, deletedAt: null } });
  },

  findAll: () => prisma.user.findMany({ where: { deletedAt: null } }),

  update: (
    id: string,
    data: Omit<UpdateUserDto, "dateOfBirth"> & { dateOfBirth?: Date },
  ) => prisma.user.update({ where: { id }, data }),

  changeRole: (id: string, role: UserRole) =>
    prisma.user.update({ where: { id }, data: { role } }),

  setActive: (id: string, isActive: boolean) =>
    prisma.user.update({ where: { id }, data: { isActive } }),

  delete: (id: string) =>
    prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    }),
};
