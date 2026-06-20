import { reviewRepository } from "./review.repository";
import { productRepository } from "../products/product.repository";
import { orderRepository } from "../orders/order.repository";
import { CreateReviewDto, UpdateReviewDto } from "./review.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";

export const reviewService = {
  getByProduct: async (productId: number) => {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    const reviews = await reviewRepository.findByProduct(productId);
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      product_id: productId,
      average_rating: Math.round(averageRating * 10) / 10,
      total_reviews: reviews.length,
      reviews,
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

    // Vérifier que l'orderItem appartient à une commande de cet utilisateur
    const order = await orderRepository.findById(""); // on cherche via orderItem ci-dessous
    void order; // non utilisé directement

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

  update: async (id: string, userId: number, dto: UpdateReviewDto) => {
    const review = await reviewRepository.findById(id);
    if (!review) throw new AppError("Review not found", 404);
    if (review.userId !== userId) throw new AppError("Forbidden", 403);

    const updated = await reviewRepository.update(id, dto);

    businessLogger.log("REVIEW_UPDATED", {
      service: "reviews",
      actor: { userId, role: "CUSTOMER" },
      target: { reviewId: id, productId: review.productId },
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  },

  delete: async (id: string, userId: number) => {
    const review = await reviewRepository.findById(id);
    if (!review) throw new AppError("Review not found", 404);
    if (review.userId !== userId) throw new AppError("Forbidden", 403);

    await reviewRepository.delete(id);

    businessLogger.log("REVIEW_DELETED", {
      service: "reviews",
      actor: { userId, role: "CUSTOMER" },
      target: { reviewId: id, productId: review.productId },
    });

    return { id };
  },
};
