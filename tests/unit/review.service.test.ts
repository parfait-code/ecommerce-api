import { reviewService } from '../../src/modules/reviews/review.service'
import { reviewRepository } from '../../src/modules/reviews/review.repository'
import { productRepository } from '../../src/modules/products/product.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/reviews/review.repository')
jest.mock('../../src/modules/products/product.repository')

const mockReviewRepository = reviewRepository as jest.Mocked<typeof reviewRepository>
const mockProductRepository = productRepository as jest.Mocked<typeof productRepository>

const mockProduct = {
  id: 1,
  name: 'Test Product',
  description: null,
  price: 99.99,
  category: 'Electronics',
  stock: 10,
  images: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockReview = {
  id: 'review-cuid-1',
  productId: 1,
  userId: 1,
  rating: 4,
  comment: 'Great product!',
  createdAt: new Date(),
  updatedAt: new Date(),
  user: {
    id: 1,
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
  },
}

const mockReviewList = [
  mockReview,
  { ...mockReview, id: 'review-cuid-2', userId: 2, rating: 5, comment: 'Excellent!' },
]

describe('ReviewService', () => {
  describe('getByProduct', () => {
    it('should return reviews with average rating', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      mockReviewRepository.findByProduct.mockResolvedValue(mockReviewList)

      const result = await reviewService.getByProduct(1)

      expect(result.product_id).toBe(1)
      expect(result.total_reviews).toBe(2)
      expect(result.average_rating).toBe(4.5) // (4 + 5) / 2
      expect(result.reviews).toHaveLength(2)
    })

    it('should return 0 average rating if no reviews', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      mockReviewRepository.findByProduct.mockResolvedValue([])

      const result = await reviewService.getByProduct(1)

      expect(result.total_reviews).toBe(0)
      expect(result.average_rating).toBe(0)
      expect(result.reviews).toHaveLength(0)
    })

    it('should throw 404 if product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null)

      await expect(reviewService.getByProduct(999)).rejects.toThrow(
        new AppError('Product not found', 404),
      )
    })

    it('should round average rating to 1 decimal', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      mockReviewRepository.findByProduct.mockResolvedValue([
        { ...mockReview, rating: 4 },
        { ...mockReview, id: 'review-cuid-2', rating: 3 },
        { ...mockReview, id: 'review-cuid-3', rating: 5 },
      ])

      const result = await reviewService.getByProduct(1)

      expect(result.average_rating).toBe(4) // (4+3+5)/3 = 4.0
    })
  })

  describe('getById', () => {
    it('should return review if found', async () => {
      mockReviewRepository.findById.mockResolvedValue(mockReview)

      const result = await reviewService.getById('review-cuid-1')

      expect(result).toEqual(mockReview)
    })

    it('should throw 404 if review not found', async () => {
      mockReviewRepository.findById.mockResolvedValue(null)

      await expect(reviewService.getById('nonexistent')).rejects.toThrow(
        new AppError('Review not found', 404),
      )
    })
  })

  describe('create', () => {
    it('should create a review', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      mockReviewRepository.findByUserAndProduct.mockResolvedValue(null)
      mockReviewRepository.create.mockResolvedValue(mockReview)

      const result = await reviewService.create(1, {
        product_id: 1,
        rating: 4,
        comment: 'Great product!',
      })

      expect(mockReviewRepository.create).toHaveBeenCalledWith(1, {
        product_id: 1,
        rating: 4,
        comment: 'Great product!',
      })
      expect(result).toEqual(mockReview)
    })

    it('should throw 404 if product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null)

      await expect(
        reviewService.create(1, { product_id: 999, rating: 4 }),
      ).rejects.toThrow(new AppError('Product not found', 404))
    })

    it('should throw 409 if user already reviewed this product', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      mockReviewRepository.findByUserAndProduct.mockResolvedValue(mockReview)

      await expect(
        reviewService.create(1, { product_id: 1, rating: 5 }),
      ).rejects.toThrow(new AppError('You have already reviewed this product', 409))
    })
  })

  describe('update', () => {
    it('should update a review', async () => {
      const updated = { ...mockReview, rating: 5, comment: 'Even better!' }
      mockReviewRepository.findById.mockResolvedValue(mockReview)
      mockReviewRepository.update.mockResolvedValue(updated)

      const result = await reviewService.update('review-cuid-1', 1, {
        rating: 5,
        comment: 'Even better!',
      })

      expect(result.rating).toBe(5)
      expect(result.comment).toBe('Even better!')
    })

    it('should throw 404 if review not found', async () => {
      mockReviewRepository.findById.mockResolvedValue(null)

      await expect(
        reviewService.update('nonexistent', 1, { rating: 5 }),
      ).rejects.toThrow(new AppError('Review not found', 404))
    })

    it('should throw 403 if user does not own the review', async () => {
      mockReviewRepository.findById.mockResolvedValue(mockReview) // userId: 1

      await expect(
        reviewService.update('review-cuid-1', 99, { rating: 5 }),
      ).rejects.toThrow(new AppError('Forbidden', 403))
    })
  })

  describe('delete', () => {
    it('should delete a review and return its id', async () => {
      mockReviewRepository.findById.mockResolvedValue(mockReview)
      mockReviewRepository.delete.mockResolvedValue(mockReview)

      const result = await reviewService.delete('review-cuid-1', 1)

      expect(mockReviewRepository.delete).toHaveBeenCalledWith('review-cuid-1')
      expect(result).toEqual({ id: 'review-cuid-1' })
    })

    it('should throw 404 if review not found', async () => {
      mockReviewRepository.findById.mockResolvedValue(null)

      await expect(reviewService.delete('nonexistent', 1)).rejects.toThrow(
        new AppError('Review not found', 404),
      )
    })

    it('should throw 403 if user does not own the review', async () => {
      mockReviewRepository.findById.mockResolvedValue(mockReview) // userId: 1

      await expect(reviewService.delete('review-cuid-1', 99)).rejects.toThrow(
        new AppError('Forbidden', 403),
      )
    })
  })
})