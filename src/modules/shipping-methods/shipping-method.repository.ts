import { prisma } from "../../shared/config/database";
import {
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
} from "./shipping-method.schema";

export const shippingMethodRepository = {
  findAll: (onlyActive = false) =>
    prisma.shippingMethod.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    }),

  findById: (id: string) => prisma.shippingMethod.findUnique({ where: { id } }),

  create: (data: CreateShippingMethodDto) =>
    prisma.shippingMethod.create({ data }),

  update: (id: string, data: UpdateShippingMethodDto) =>
    prisma.shippingMethod.update({ where: { id }, data }),

  delete: (id: string) => prisma.shippingMethod.delete({ where: { id } }),
};
