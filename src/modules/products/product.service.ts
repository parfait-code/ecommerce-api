import { productRepository } from './product.repository'
import { CreateProductDto, UpdateProductDto } from './product.schema'
import { AppError } from '../../shared/utils/app-error'
import { cache } from '../../shared/utils/cache'

const CACHE_KEYS = {
  all: (page: number, limit: number) => `products:all:${page}:${limit}`,
  single: (id: number) => `products:${id}`,
}

export const productService = {
  getAll: async (query: { page?: string; limit?: string }) => {
    const page = Number(query.page ?? 1)
    const limit = Number(query.limit ?? 20)
    const cacheKey = CACHE_KEYS.all(page, limit)

    const cached = await cache.get(cacheKey)
    if (cached) return cached

    const [items, total] = await productRepository.findAll(query)
    const result = { items, total, page, limit, totalPages: Math.ceil(total / limit) }

    await cache.set(cacheKey, result)
    return result
  },

  getById: async (id: number) => {
    const cacheKey = CACHE_KEYS.single(id)

    const cached = await cache.get(cacheKey)
    if (cached) return cached

    const product = await productRepository.findById(id)
    if (!product) throw new AppError('Product not found', 404)

    await cache.set(cacheKey, product)
    return product
  },

  create: async (dto: CreateProductDto) => {
    const product = await productRepository.create(dto)
    await cache.delByPattern('products:all:*')
    return product
  },

  update: async (id: number, dto: UpdateProductDto) => {
    const product = await productRepository.findById(id)
    if (!product) throw new AppError('Product not found', 404)
    const updated = await productRepository.update(id, dto)
    await cache.del(CACHE_KEYS.single(id))
    await cache.delByPattern('products:all:*')
    return updated
  },

  delete: async (id: number) => {
    const product = await productRepository.findById(id)
    if (!product) throw new AppError('Product not found', 404)
    await productRepository.delete(id)
    await cache.del(CACHE_KEYS.single(id))
    await cache.delByPattern('products:all:*')
    return { numberOfProductsDeleted: 1 }
  },
}