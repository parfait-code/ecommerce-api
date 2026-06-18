import { prisma } from '../../shared/config/database'
import { CreateProductDto, UpdateProductDto } from './product.schema'
import { paginate } from '../../shared/utils/pagination'

const productInclude = {
  category: {
    select: { id: true, name: true, slug: true },
  },
}

export const productRepository = {
  findAll: async (query: { page?: string; limit?: string; categoryId?: string }) => {
    const { skip, take } = paginate(query)
    const where = {
      ...(query.categoryId && { categoryId: query.categoryId }),
    }
    const items = await prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: productInclude,
    })
    const total = await prisma.product.count({ where })
    return [items, total] as const
  },

  findById: (id: number) =>
    prisma.product.findUnique({
      where: { id },
      include: productInclude,
    }),

  create: (data: CreateProductDto) =>
    prisma.product.create({
      data,
      include: productInclude,
    }),

  update: (id: number, data: UpdateProductDto) =>
    prisma.product.update({
      where: { id },
      data,
      include: productInclude,
    }),

  delete: (id: number) =>
    prisma.product.delete({ where: { id } }),
}