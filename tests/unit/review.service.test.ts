import { reviewService } from "../../src/modules/reviews/review.service";
import { reviewRepository } from "../../src/modules/reviews/review.repository";
import { productRepository } from "../../src/modules/products/product.repository";
import { AppError } from "../../src/shared/utils/app-error";
import {
  makeProduct,
  makeReview,
  makeOrderItemForReview,
} from "../mocks/factories";

jest.mock("../../src/modules/reviews/review.repository");
jest.mock("../../src/modules/products/product.repository");

const mockedRepo = reviewRepository as jest.Mocked<typeof reviewRepository>;
const mockedProductRepo = productRepository as jest.Mocked<
  typeof productRepository
>;

describe("reviewService.getByProduct", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si produit introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(null);
    await expect(reviewService.getByProduct(99)).rejects.toThrow(AppError);
  });

  it("calcule correctement la note moyenne", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findByProduct.mockResolvedValue([
      makeReview({ rating: 5 }),
      makeReview({ rating: 3 }),
    ] as any);

    const result = await reviewService.getByProduct(1);

    expect(result.total_reviews).toBe(2);
    expect(result.average_rating).toBe(4);
  });

  it("retourne 0 si aucun avis", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findByProduct.mockResolvedValue([] as any);

    const result = await reviewService.getByProduct(1);

    expect(result.average_rating).toBe(0);
    expect(result.total_reviews).toBe(0);
  });
});

describe("reviewService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = {
    order_item_id: "item_1",
    product_id: 1,
    rating: 5,
    comment: "Top",
  };

  it("rejette si produit introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(null);
    await expect(reviewService.create(1, dto as any)).rejects.toThrow(
      "Product not found",
    );
  });

  it("rejette si l'order item est introuvable", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findOrderItem.mockResolvedValue(null);

    await expect(reviewService.create(1, dto as any)).rejects.toThrow(
      "Order item not found",
    );
  });

  it("rejette si l'order item n'appartient pas à l'utilisateur", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findOrderItem.mockResolvedValue(
      makeOrderItemForReview({ order: { userId: 2 } }) as any,
    );

    await expect(reviewService.create(1, dto as any)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("rejette si l'order item ne correspond pas au produit donné", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findOrderItem.mockResolvedValue(
      makeOrderItemForReview({ productId: 2 }) as any,
    );

    await expect(reviewService.create(1, dto as any)).rejects.toThrow(
      "does not match the given product",
    );
  });

  it("rejette si l'utilisateur a déjà laissé un avis pour cet achat", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findOrderItem.mockResolvedValue(makeOrderItemForReview() as any);
    mockedRepo.findByOrderItemAndUser.mockResolvedValue(makeReview() as any);

    await expect(reviewService.create(1, dto as any)).rejects.toThrow(
      "already reviewed this purchase",
    );
  });

  it("crée un avis valide", async () => {
    mockedProductRepo.findById.mockResolvedValue(makeProduct({ id: 1 }) as any);
    mockedRepo.findOrderItem.mockResolvedValue(makeOrderItemForReview() as any);
    mockedRepo.findByOrderItemAndUser.mockResolvedValue(null);
    mockedRepo.create.mockResolvedValue(makeReview() as any);

    const result = await reviewService.create(1, dto as any);

    expect(result.id).toBe("review_1");
    expect(mockedRepo.create).toHaveBeenCalledWith(1, dto);
  });
});

describe("reviewService.update / delete (ownership)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("update rejette si avis introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(
      reviewService.update("review_1", 1, { rating: 4 } as any),
    ).rejects.toThrow(AppError);
  });

  it("update rejette si l'utilisateur n'est pas le propriétaire", async () => {
    mockedRepo.findById.mockResolvedValue(makeReview({ userId: 2 }) as any);
    await expect(
      reviewService.update("review_1", 1, { rating: 4 } as any),
    ).rejects.toThrow("Forbidden");
  });

  it("update fonctionne pour le propriétaire", async () => {
    mockedRepo.findById.mockResolvedValue(makeReview({ userId: 1 }) as any);
    mockedRepo.update.mockResolvedValue(
      makeReview({ userId: 1, rating: 4 }) as any,
    );

    const result = await reviewService.update("review_1", 1, {
      rating: 4,
    } as any);
    expect(result.rating).toBe(4);
  });

  it("delete rejette si l'utilisateur n'est pas le propriétaire", async () => {
    mockedRepo.findById.mockResolvedValue(makeReview({ userId: 2 }) as any);
    await expect(reviewService.delete("review_1", 1)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("delete fonctionne pour le propriétaire", async () => {
    mockedRepo.findById.mockResolvedValue(makeReview({ userId: 1 }) as any);

    const result = await reviewService.delete("review_1", 1);
    expect(result.id).toBe("review_1");
    expect(mockedRepo.delete).toHaveBeenCalledWith("review_1");
  });
});
