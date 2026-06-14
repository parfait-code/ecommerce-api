import { prisma } from '../../shared/config/database'
import { CreateReviewDto, UpdateReviewDto } from './review.schema'

const reviewInclude = {
  user: { select: { id: true, username: true, firstName: true, lastName: true } },
}

export const reviewRepository = {
  findByProduct: (productId: number) =>
    prisma.review.findMany({
      where: { productId },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
    }),

  findById: (id: string) =>
    prisma.review.findUnique({ where: { id }, include: reviewInclude }),

  findByUserAndProduct: (userId: number, productId: number) =>
    prisma.review.findUnique({ where: { productId_userId: { productId, userId } } }),

  create: (userId: number, dto: CreateReviewDto) =>
    prisma.review.create({
      data: {
        userId,
        productId: dto.product_id,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: reviewInclude,
    }),

  update: (id: string, dto: UpdateReviewDto) =>
    prisma.review.update({ where: { id }, data: dto, include: reviewInclude }),

  delete: (id: string) =>
    prisma.review.delete({ where: { id } }),
}