// tests/unit/product.service.test.ts
import { productService } from '../../src/modules/products/product.service'
import { productRepository } from '../../src/modules/products/product.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/products/product.repository')
jest.mock('../../src/shared/utils/cache', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
  },
}))

const mockProductRepository = productRepository as jest.Mocked<typeof productRepository>

const mockCategory = {
  id: 'cat-cuid-1',
  name: 'Electronics',
  slug: 'electronics',
}

const mockProduct = {
  id: 1,
  name: 'Test Product',
  description: 'A test product',
  price: 99.99,
  categoryId: 'cat-cuid-1',
  category: mockCategory,
  stock: 10,
  images: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('ProductService', () => {
  describe('getById', () => {
    it('should return product with category if found', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      const result = await productService.getById(1)
      expect(result).toEqual(mockProduct)
      expect(result).toHaveProperty('category')
      expect((result as typeof mockProduct).category.slug).toBe('electronics')
    })

    it('should throw 404 if product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null)
      await expect(productService.getById(999)).rejects.toThrow(
        new AppError('Product not found', 404),
      )
    })
  })

  describe('create', () => {
    it('should create product with categoryId', async () => {
      mockProductRepository.create.mockResolvedValue(mockProduct)
      const result = await productService.create({
        name: 'Test Product',
        price: 99.99,
        categoryId: 'cat-cuid-1',
        stock: 10,
        images: [],
      })
      expect(result).toEqual(mockProduct)
      expect(result).toHaveProperty('categoryId', 'cat-cuid-1')
    })
  })

  describe('delete', () => {
    it('should delete product and return count', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      mockProductRepository.delete.mockResolvedValue(mockProduct)
      const result = await productService.delete(1)
      expect(result).toEqual({ numberOfProductsDeleted: 1 })
    })

    it('should throw 404 if product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null)
      await expect(productService.delete(999)).rejects.toThrow(
        new AppError('Product not found', 404),
      )
    })
  })

  describe('getAll', () => {
    it('should return paginated products', async () => {
      mockProductRepository.findAll.mockResolvedValue([[mockProduct], 1])
      const result = await productService.getAll({ page: '1', limit: '20' }) as {
        items: typeof mockProduct[]
        total: number
        totalPages: number
      }
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.totalPages).toBe(1)
    })

    it('should filter by categoryId', async () => {
      mockProductRepository.findAll.mockResolvedValue([[mockProduct], 1])
      await productService.getAll({ categoryId: 'cat-cuid-1' })
      expect(mockProductRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 'cat-cuid-1' }),
      )
    })
  })

  describe('update', () => {
    it('should update product and return updated', async () => {
      const updated = { ...mockProduct, price: 149.99 }
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      mockProductRepository.update.mockResolvedValue(updated)
      const result = await productService.update(1, { price: 149.99 })
      expect((result as typeof mockProduct).price).toBe(149.99)
    })

    it('should throw 404 if product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null)
      await expect(productService.update(999, { price: 50 })).rejects.toThrow(
        new AppError('Product not found', 404),
      )
    })
  })
})