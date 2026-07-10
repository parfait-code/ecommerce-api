import { reviewRepository } from "./review.repository";
import { productRepository } from "../products/product.repository";
import { CreateReviewDto, UpdateReviewDto } from "./review.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";

export const reviewService = {
  getByProduct: async (
    productId: number,
    query: { page?: string; limit?: string },
  ) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    const [reviews, total] = await reviewRepository.findByProduct(
      productId,
      query,
    );

    const allRatings =
      await reviewRepository.findAllRatingsByProduct(productId);
    const averageRating =
      allRatings.length > 0
        ? allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
        : 0;

    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    return {
      product_id: productId,
      average_rating: Math.round(averageRating * 10) / 10,
      total_reviews: total,
      reviews,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  getById: async (id: string) => {
    const review = await reviewRepository.findById(id);
    if (!review) throw new AppError("Review not found", 404);
    return review;
  },

  create: async (userId: number, dto: CreateReviewDto) => {
    const product = await productRepository.findById(dto.product_id);
    if (!product) throw new AppError("Product not found", 404);

    const orderItem = await reviewRepository.findOrderItem(dto.order_item_id);
    if (!orderItem) throw new AppError("Order item not found", 404);
    if (orderItem.order.userId !== userId) throw new AppError("Forbidden", 403);
    if (orderItem.productId !== dto.product_id)
      throw new AppError(
        "This order item does not match the given product",
        400,
      );

    if (orderItem.order.status !== "DELIVERED")
      throw new AppError(
        "You can only review products from delivered orders",
        400,
      );

    const existingReview = await reviewRepository.findByOrderItemAndUser(
      dto.order_item_id,
      userId,
    );
    if (existingReview)
      throw new AppError("You have already reviewed this purchase", 409);

    const review = await reviewRepository.create(userId, dto);

    businessLogger.log("REVIEW_CREATED", {
      service: "reviews",
      actor: { userId, role: "CUSTOMER" },
      target: { reviewId: review.id, productId: dto.product_id },
      metadata: { rating: dto.rating },
    });

    return review;
  },

  // Bypass admin — même pattern que orders/returns/baskets/shipments :
  // le propriétaire OU un admin peut agir, sinon 403.
  update: async (
    id: string,
    userId: number,
    isAdmin: boolean,
    dto: UpdateReviewDto,
  ) => {
    const review = await reviewRepository.findById(id);
    if (!review) throw new AppError("Review not found", 404);
    if (!isAdmin && review.userId !== userId)
      throw new AppError("Forbidden", 403);

    const updated = await reviewRepository.update(id, dto);

    businessLogger.log("REVIEW_UPDATED", {
      service: "reviews",
      actor: { userId, role: isAdmin ? "ADMIN" : "CUSTOMER" },
      target: { reviewId: id, productId: review.productId },
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  },

  delete: async (id: string, userId: number, isAdmin: boolean) => {
    const review = await reviewRepository.findById(id);
    if (!review) throw new AppError("Review not found", 404);
    if (!isAdmin && review.userId !== userId)
      throw new AppError("Forbidden", 403);

    await reviewRepository.delete(id);

    businessLogger.log("REVIEW_DELETED", {
      service: "reviews",
      actor: { userId, role: isAdmin ? "ADMIN" : "CUSTOMER" },
      target: { reviewId: id, productId: review.productId },
    });

    return { id };
  },
};
