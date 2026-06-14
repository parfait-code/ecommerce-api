import { inventoryRepository } from './inventory.repository'
import { warehouseRepository } from '../warehouses/warehouse.repository'
import { productRepository } from '../products/product.repository'
import { CreateInventoryDto, UpdateInventoryDto, TransferInventoryDto } from './inventory.schema'
import { AppError } from '../../shared/utils/app-error'

export const inventoryService = {
  getAll: (query: { category?: string; location?: string }) =>
    inventoryRepository.findAll(query),

  getById: async (id: string) => {
    const item = await inventoryRepository.findById(id)
    if (!item) throw new AppError('Inventory item not found', 404)
    return item
  },

  getLowStock: (threshold: number) =>
    inventoryRepository.findLowStock(threshold),

  getOutOfStock: () =>
    inventoryRepository.findOutOfStock(),

  search: (keyword: string) =>
    inventoryRepository.search(keyword),

  create: async (dto: CreateInventoryDto) => {
    const product = await productRepository.findById(dto.product_id)
    if (!product) throw new AppError('Product not found', 404)

    const warehouse = await warehouseRepository.findById(dto.warehouse_id)
    if (!warehouse) throw new AppError('Warehouse not found', 404)

    const existing = await inventoryRepository.findByProductAndWarehouse(dto.product_id, dto.warehouse_id)
    if (existing) throw new AppError('Inventory item already exists for this product and warehouse', 409)

    return inventoryRepository.create(dto)
  },

  update: async (id: string, dto: UpdateInventoryDto) => {
    const item = await inventoryRepository.findById(id)
    if (!item) throw new AppError('Inventory item not found', 404)
    return inventoryRepository.update(id, dto)
  },

  delete: async (id: string) => {
    const item = await inventoryRepository.findById(id)
    if (!item) throw new AppError('Inventory item not found', 404)
    await inventoryRepository.delete(id)
    return { message: 'Inventory item deleted successfully' }
  },

  transfer: async (dto: TransferInventoryDto) => {
    const source = await inventoryRepository.findByProductAndWarehouse(
      (await inventoryRepository.findById(dto.item_id))!.productId,
      dto.from_warehouse,
    )
    if (!source) throw new AppError('Source inventory not found', 404)
    if (source.quantity < dto.quantity) throw new AppError('Insufficient stock in source warehouse', 400)

    const destination = await inventoryRepository.findByProductAndWarehouse(
      source.productId,
      dto.to_warehouse,
    )

    await inventoryRepository.decrementQuantity(source.id, dto.quantity)

    if (destination) {
      await inventoryRepository.incrementQuantity(destination.id, dto.quantity)
    } else {
      await inventoryRepository.create({
        product_id: source.productId,
        warehouse_id: dto.to_warehouse,
        quantity: dto.quantity,
      })
    }

    return {
      item_id: dto.item_id,
      from_warehouse: dto.from_warehouse,
      to_warehouse: dto.to_warehouse,
      quantity: dto.quantity,
    }
  },
}