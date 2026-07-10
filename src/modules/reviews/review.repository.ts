import { prisma } from "../../shared/config/database";
import { CreateReviewDto, UpdateReviewDto } from "./review.schema";
import { paginate } from "../../shared/utils/pagination";

const reviewInclude = {
  user: {
    select: { id: true, username: true, firstName: true, lastName: true },
  },
};

export const reviewRepository = {
  findByProduct: (
    productId: number,
    query: { page?: string; limit?: string },
  ) => {
    const { skip, take } = paginate(query);
    const where = { productId };
    return Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take,
        include: reviewInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.review.count({ where }),
    ]);
  },

  // Utilisé pour le calcul de la moyenne — doit porter sur TOUS les avis,
  // pas seulement la page courante, sinon average_rating varie selon la page.
  findAllRatingsByProduct: (productId: number) =>
    prisma.review.findMany({
      where: { productId },
      select: { rating: true },
    }),

  findById: (id: string) =>
    prisma.review.findUnique({ where: { id }, include: reviewInclude }),

  findByOrderItemAndUser: (orderItemId: string, userId: number) =>
    prisma.review.findUnique({
      where: { orderItemId_userId: { orderItemId, userId } },
    }),

  findOrderItem: (orderItemId: string) =>
    prisma.orderItem.findUnique({
      where: { id: orderItemId },
      select: {
        id: true,
        productId: true,
        order: { select: { userId: true, status: true } },
      },
    }),

  create: (userId: number, dto: CreateReviewDto) =>
    prisma.review.create({
      data: {
        userId,
        orderItemId: dto.order_item_id,
        productId: dto.product_id,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: reviewInclude,
    }),

  update: (id: string, dto: UpdateReviewDto) =>
    prisma.review.update({ where: { id }, data: dto, include: reviewInclude }),

  delete: (id: string) => prisma.review.delete({ where: { id } }),
};
