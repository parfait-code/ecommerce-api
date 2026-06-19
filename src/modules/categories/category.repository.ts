import { prisma } from '../../shared/config/database'
import { CreateCategoryDto, UpdateCategoryDto } from './category.schema'

const categoryInclude = {
  parent:   { select: { id: true, name: true, slug: true } },
  children: { select: { id: true, name: true, slug: true } },
  _count:   { select: { products: true } },
}

export const categoryRepository = {
  findAll: () =>
    prisma.category.findMany({
      include:  categoryInclude,
      orderBy:  { name: 'asc' },
    }),

  findById: (id: string) =>
    prisma.category.findUnique({
      where:   { id },
      include: categoryInclude,
    }),

  findBySlug: (slug: string) =>
    prisma.category.findUnique({
      where:   { slug },
      include: categoryInclude,
    }),

  findProducts: (
    slug: string,
    query: { page?: string; limit?: string },
  ) => {
    const page  = Number(query.page  ?? 1)
    const limit = Number(query.limit ?? 20)
    const skip  = (page - 1) * limit

    return Promise.all([
      prisma.product.findMany({
        where:   { category: { slug } },
        skip,
        take:    limit,
        include: { category: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where: { category: { slug } } }),
    ])
  },

  create: (data: CreateCategoryDto) =>
    prisma.category.create({
      data,
      include: categoryInclude,
    }),

  update: (id: string, data: UpdateCategoryDto) =>
    prisma.category.update({
      where:   { id },
      data,
      include: categoryInclude,
    }),

  delete: (id: string) =>
    prisma.category.delete({ where: { id } }),

  existsByName: (name: string) =>
    prisma.category.findUnique({ where: { name } }),

  existsBySlug: (slug: string) =>
    prisma.category.findUnique({ where: { slug } }),
}