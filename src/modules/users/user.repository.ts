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

  // U2/U3/U4 — bascule isActive indépendamment de deletedAt
  setActive: (id: number, isActive: boolean) =>
    prisma.user.update({ where: { id }, data: { isActive } }),

  delete: (id: number) =>
    prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    }),
};
