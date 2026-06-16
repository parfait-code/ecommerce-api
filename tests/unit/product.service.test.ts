import { productService } from '../../src/modules/products/product.service'
import { productRepository } from '../../src/modules/products/product.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/products/product.repository')

const mockProductRepository = productRepository as jest.Mocked<typeof productRepository>

const mockProduct = {
  id: 1,
  name: 'Test Product',
  description: 'A test product',
  price: 99.99,
  category: 'Electronics',
  stock: 10,
  images: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('ProductService', () => {
  describe('getById', () => {
    it('should return product if found', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      const result = await productService.getById(1)
      expect(result).toEqual(mockProduct)
    })

    it('should throw 404 if product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null)
      await expect(productService.getById(999)).rejects.toThrow(
        new AppError('Product not found', 404),
      )
    })
  })

  describe('create', () => {
    it('should create and return product', async () => {
      mockProductRepository.create.mockResolvedValue(mockProduct)
      const result = await productService.create({
        name: 'Test Product',
        price: 99.99,
        category: 'Electronics',
        stock: 10,
        images: [],
      })
      expect(result).toEqual(mockProduct)
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
})
})