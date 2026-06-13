import { productRepository } from './product.repository'
import { CreateProductDto, UpdateProductDto } from './product.schema'
import { AppError } from '../../shared/utils/app-error'

export const productService = {
  getAll: async (query: { page?: string; limit?: string }) => {
    const [items, total] = await productRepository.findAll(query)
    const page = Number(query.page ?? 1)
    const limit = Number(query.limit ?? 20)
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  },

  getById: async (id: number) => {
    const product = await productRepository.findById(id)
    if (!product) throw new AppError('Product not found', 404)
    return product
  },

  create: async (dto: CreateProductDto) => {
    return productRepository.create(dto)
  },

  update: async (id: number, dto: UpdateProductDto) => {
    const product = await productRepository.findById(id)
    if (!product) throw new AppError('Product not found', 404)
    return productRepository.update(id, dto)
  },

  delete: async (id: number) => {
    const product = await productRepository.findById(id)
    if (!product) throw new AppError('Product not found', 404)
    await productRepository.delete(id)
    return { numberOfProductsDeleted: 1 }
  },
}