// tests/unit/category.service.test.ts
import { categoryService } from '../../src/modules/categories/category.service'
import { categoryRepository } from '../../src/modules/categories/category.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/categories/category.repository')
jest.mock('../../src/shared/utils/cache', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
  },
}))

const mockCategoryRepository = categoryRepository as jest.Mocked<typeof categoryRepository>

const mockCategory = {
  id: 'cat-cuid-1',
  name: 'Electronics',
  slug: 'electronics',
  description: null,
  parentId: null,
  parent: null,
  children: [],
  _count: { products: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockCategoryWithProducts = {
  ...mockCategory,
  _count: { products: 3 },
}

describe('CategoryService', () => {
  describe('getAll', () => {
    it('should return all categories', async () => {
      mockCategoryRepository.findAll.mockResolvedValue([mockCategory])

      const result = await categoryService.getAll() as typeof mockCategory[]

      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('electronics')
    })
  })

  describe('getById', () => {
    it('should return category if found', async () => {
      mockCategoryRepository.findById.mockResolvedValue(mockCategory)

      const result = await categoryService.getById('cat-cuid-1')

      expect(result).toEqual(mockCategory)
    })

    it('should throw 404 if category not found', async () => {
      mockCategoryRepository.findById.mockResolvedValue(null)

      await expect(categoryService.getById('nonexistent')).rejects.toThrow(
        new AppError('Category not found', 404),
      )
    })
  })

  describe('getBySlug', () => {
    it('should return category by slug', async () => {
      mockCategoryRepository.findBySlug.mockResolvedValue(mockCategory)

      const result = await categoryService.getBySlug('electronics')

      expect(result).toEqual(mockCategory)
    })

    it('should throw 404 if category not found by slug', async () => {
      mockCategoryRepository.findBySlug.mockResolvedValue(null)

      await expect(categoryService.getBySlug('nonexistent')).rejects.toThrow(
        new AppError('Category not found', 404),
      )
    })
  })

  describe('getProducts', () => {
    it('should return paginated products for a category', async () => {
      const mockProduct = {
        id: 1, name: 'Test', description: null, price: 10,
        categoryId: 'cat-cuid-1', stock: 5, images: [],
        createdAt: new Date(), updatedAt: new Date(),
        category: { id: 'cat-cuid-1', name: 'Electronics', slug: 'electronics' },
      }
      mockCategoryRepository.findBySlug.mockResolvedValue(mockCategory)
      mockCategoryRepository.findProducts.mockResolvedValue([[mockProduct], 1])

      const result = await categoryService.getProducts('electronics', { page: '1', limit: '20' }) as {
        items: typeof mockProduct[]
        total: number
        totalPages: number
        category: { id: string; name: string; slug: string }
      }

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.category.slug).toBe('electronics')
    })

    it('should throw 404 if category slug not found', async () => {
      mockCategoryRepository.findBySlug.mockResolvedValue(null)

      await expect(
        categoryService.getProducts('nonexistent', {}),
      ).rejects.toThrow(new AppError('Category not found', 404))
    })
  })

  describe('create', () => {
    it('should create a category', async () => {
      mockCategoryRepository.existsByName.mockResolvedValue(null)
      mockCategoryRepository.existsBySlug.mockResolvedValue(null)
      mockCategoryRepository.create.mockResolvedValue(mockCategory)

      const result = await categoryService.create({
        name: 'Electronics',
        slug: 'electronics',
      })

      expect(result).toEqual(mockCategory)
      expect(mockCategoryRepository.create).toHaveBeenCalledWith({
        name: 'Electronics',
        slug: 'electronics',
      })
    })

    it('should throw 409 if name already taken', async () => {
      mockCategoryRepository.existsByName.mockResolvedValue(mockCategory)

      await expect(
        categoryService.create({ name: 'Electronics', slug: 'electronics' }),
      ).rejects.toThrow(new AppError('Category name already taken', 409))
    })

    it('should throw 409 if slug already taken', async () => {
      mockCategoryRepository.existsByName.mockResolvedValue(null)
      mockCategoryRepository.existsBySlug.mockResolvedValue(mockCategory)

      await expect(
        categoryService.create({ name: 'Electronics 2', slug: 'electronics' }),
      ).rejects.toThrow(new AppError('Category slug already taken', 409))
    })

    it('should throw 404 if parent category not found', async () => {
      mockCategoryRepository.existsByName.mockResolvedValue(null)
      mockCategoryRepository.existsBySlug.mockResolvedValue(null)
      mockCategoryRepository.findById.mockResolvedValue(null)

      await expect(
        categoryService.create({ name: 'Sub', slug: 'sub', parentId: 'nonexistent' }),
      ).rejects.toThrow(new AppError('Parent category not found', 404))
    })
  })

  describe('update', () => {
    it('should update a category', async () => {
      const updated = { ...mockCategory, name: 'Updated Electronics' }
      mockCategoryRepository.findById.mockResolvedValue(mockCategory)
      mockCategoryRepository.existsByName.mockResolvedValue(null)
      mockCategoryRepository.existsBySlug.mockResolvedValue(null)
      mockCategoryRepository.update.mockResolvedValue(updated)

      const result = await categoryService.update('cat-cuid-1', { name: 'Updated Electronics' })

      expect((result as typeof mockCategory).name).toBe('Updated Electronics')
    })

    it('should throw 404 if category not found', async () => {
      mockCategoryRepository.findById.mockResolvedValue(null)

      await expect(
        categoryService.update('nonexistent', { name: 'X' }),
      ).rejects.toThrow(new AppError('Category not found', 404))
    })

    it('should throw 400 if category is set as its own parent', async () => {
      mockCategoryRepository.findById.mockResolvedValue(mockCategory)
      mockCategoryRepository.existsByName.mockResolvedValue(null)
      mockCategoryRepository.existsBySlug.mockResolvedValue(null)

      await expect(
        categoryService.update('cat-cuid-1', { parentId: 'cat-cuid-1' }),
      ).rejects.toThrow(new AppError('A category cannot be its own parent', 400))
    })
  })

  describe('delete', () => {
    it('should delete category and return message', async () => {
      mockCategoryRepository.findById.mockResolvedValue(mockCategory)
      mockCategoryRepository.delete.mockResolvedValue(mockCategory)

      const result = await categoryService.delete('cat-cuid-1')

      expect(result).toEqual({ message: 'Category deleted successfully' })
      expect(mockCategoryRepository.delete).toHaveBeenCalledWith('cat-cuid-1')
    })

    it('should throw 404 if category not found', async () => {
      mockCategoryRepository.findById.mockResolvedValue(null)

      await expect(categoryService.delete('nonexistent')).rejects.toThrow(
        new AppError('Category not found', 404),
      )
    })

    it('should throw 400 if category has products attached', async () => {
      mockCategoryRepository.findById.mockResolvedValue(mockCategoryWithProducts)

      await expect(categoryService.delete('cat-cuid-1')).rejects.toThrow(
        new AppError('Cannot delete category with 3 product(s) attached', 400),
      )
    })
  })
})