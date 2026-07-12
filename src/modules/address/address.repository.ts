import { prisma } from "../../shared/config/database";
import { CreateAddressDto, UpdateAddressDto } from "./address.schema";

export const addressRepository = {
  findAllByUser: (userId: string) =>
    prisma.address.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),

  findById: (id: string) =>
    prisma.address.findUnique({ where: { id } }),

  create: (userId: string, data: CreateAddressDto) =>
    prisma.address.create({ data: { userId, ...data } }),

  update: (id: string, data: UpdateAddressDto) =>
    prisma.address.update({ where: { id }, data }),

  delete: (id: string) =>
    prisma.address.delete({ where: { id } }),

  unsetDefault: (userId: string) =>
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
};