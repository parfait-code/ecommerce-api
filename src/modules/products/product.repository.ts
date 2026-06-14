import { prisma } from "../../shared/config/database";
import { CreateProductDto, UpdateProductDto } from "./product.schema";
import { paginate } from "../../shared/utils/pagination";

export const productRepository = {
  findAll: async (query: { page?: string; limit?: string }) => {
  const { skip, take } = paginate(query)
  const items = await prisma.product.findMany({ skip, take, orderBy: { createdAt: 'desc' } })
  const total = await prisma.product.count()
  return [items, total] as const
},

  findById: (id: number) => prisma.product.findUnique({ where: { id } }),

  create: (data: CreateProductDto) => prisma.product.create({ data }),

  update: (id: number, data: UpdateProductDto) =>
    prisma.product.update({ where: { id }, data }),

  delete: (id: number) => prisma.product.delete({ where: { id } }),
};
