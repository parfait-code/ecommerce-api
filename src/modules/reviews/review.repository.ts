import { prisma } from "../../shared/config/database";
import { CreateReviewDto, UpdateReviewDto } from "./review.schema";

const reviewInclude = {
  user: {
    select: { id: true, username: true, firstName: true, lastName: true },
  },
};

export const reviewRepository = {
  findByProduct: (productId: number) =>
    prisma.review.findMany({
      where: { productId },
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
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
