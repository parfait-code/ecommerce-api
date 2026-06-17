import { inventoryRepository } from './inventory.repository'
import { warehouseRepository }  from '../warehouses/warehouse.repository'
import { productRepository }    from '../products/product.repository'
import { CreateInventoryDto, UpdateInventoryDto, TransferInventoryDto } from './inventory.schema'
import { AppError }             from '../../shared/utils/app-error'
import { businessLogger, auditLogger } from '../../shared/logger'

const LOW_STOCK_THRESHOLD = 10

export const inventoryService = {
  getAll: (query: { category?: string; location?: string }) =>
    inventoryRepository.findAll(query),

  getById: async (id: string) => {
    const item = await inventoryRepository.findById(id)
    if (!item) throw new AppError('Inventory item not found', 404)
    return item
  },

  getLowStock:   (threshold: number) => inventoryRepository.findLowStock(threshold),
  getOutOfStock: ()                  => inventoryRepository.findOutOfStock(),
  search:        (keyword: string)   => inventoryRepository.search(keyword),

  create: async (dto: CreateInventoryDto) => {
    const product = await productRepository.findById(dto.product_id)
    if (!product) throw new AppError('Product not found', 404)

    const warehouse = await warehouseRepository.findById(dto.warehouse_id)
    if (!warehouse) throw new AppError('Warehouse not found', 404)

    const existing = await inventoryRepository.findByProductAndWarehouse(
      dto.product_id, dto.warehouse_id,
    )
    if (existing) throw new AppError('Inventory item already exists for this product and warehouse', 409)

    const item = await inventoryRepository.create(dto)

    businessLogger.log('STOCK_ADDED', {
      service: 'inventory',
      actor:   { userId: null, role: 'ADMIN' },
      target:  { inventoryId: item.id, productId: dto.product_id, warehouseId: dto.warehouse_id },
      metadata: { quantity: dto.quantity },
    })

    auditLogger.log('STOCK_ADDED', {
      service: 'inventory',
      actor:   { userId: null, role: 'ADMIN' },
      target:  { inventoryId: item.id, productId: dto.product_id },
      metadata: { quantity: dto.quantity, warehouseId: dto.warehouse_id },
    })

    return item
  },

  update: async (id: string, dto: UpdateInventoryDto) => {
    const item = await inventoryRepository.findById(id)
    if (!item) throw new AppError('Inventory item not found', 404)

    const updated = await inventoryRepository.update(id, dto)

    businessLogger.log('STOCK_ADJUSTED', {
      service: 'inventory',
      actor:   { userId: null, role: 'ADMIN' },
      target:  { inventoryId: id, productId: item.productId },
      metadata: { oldQuantity: item.quantity, newQuantity: dto.quantity },
    })

    auditLogger.log('STOCK_ADJUSTED', {
      service: 'inventory',
      actor:   { userId: null, role: 'ADMIN' },
      target:  { inventoryId: id },
      metadata: { oldQuantity: item.quantity, newQuantity: dto.quantity },
    })

    // Alertes stock
    if (dto.quantity !== undefined) {
      if (dto.quantity === 0) {
        businessLogger.log('OUT_OF_STOCK', {
          service: 'inventory',
          actor:   { userId: null, role: 'SYSTEM' },
          target:  { inventoryId: id, productId: item.productId },
        })
      } else if (dto.quantity <= LOW_STOCK_THRESHOLD) {
        businessLogger.log('LOW_STOCK', {
          service: 'inventory',
          actor:   { userId: null, role: 'SYSTEM' },
          target:  { inventoryId: id, productId: item.productId },
          metadata: { quantity: dto.quantity, threshold: LOW_STOCK_THRESHOLD },
        })
      }
    }

    return updated
  },

  delete: async (id: string) => {
    const item = await inventoryRepository.findById(id)
    if (!item) throw new AppError('Inventory item not found', 404)

    await inventoryRepository.delete(id)

    businessLogger.log('STOCK_REMOVED', {
      service: 'inventory',
      actor:   { userId: null, role: 'ADMIN' },
      target:  { inventoryId: id, productId: item.productId },
    })

    auditLogger.log('STOCK_REMOVED', {
      service: 'inventory',
      actor:   { userId: null, role: 'ADMIN' },
      target:  { inventoryId: id },
      metadata: { productId: item.productId, warehouseId: item.warehouseId },
    })

    return { message: 'Inventory item deleted successfully' }
  },

  transfer: async (dto: TransferInventoryDto) => {
    const itemById = await inventoryRepository.findById(dto.item_id)

    const source = await inventoryRepository.findByProductAndWarehouse(
      itemById!.productId,
      dto.from_warehouse,
    )
    if (!source) throw new AppError('Source inventory not found', 404)
    if (source.quantity < dto.quantity)
      throw new AppError('Insufficient stock in source warehouse', 400)

    const destination = await inventoryRepository.findByProductAndWarehouse(
      source.productId,
      dto.to_warehouse,
    )

    await inventoryRepository.decrementQuantity(source.id, dto.quantity)

    if (destination) {
      await inventoryRepository.incrementQuantity(destination.id, dto.quantity)
    } else {
      await inventoryRepository.create({
        product_id:   source.productId,
        warehouse_id: dto.to_warehouse,
        quantity:     dto.quantity,
      })
    }

    businessLogger.log('STOCK_TRANSFERRED', {
      service: 'inventory',
      actor:   { userId: null, role: 'ADMIN' },
      target:  { inventoryId: dto.item_id, productId: source.productId },
      metadata: {
        fromWarehouse: dto.from_warehouse,
        toWarehouse:   dto.to_warehouse,
        quantity:      dto.quantity,
      },
    })

    auditLogger.log('STOCK_TRANSFERRED', {
      service: 'inventory',
      actor:   { userId: null, role: 'ADMIN' },
      target:  { inventoryId: dto.item_id },
      metadata: {
        fromWarehouse: dto.from_warehouse,
        toWarehouse:   dto.to_warehouse,
        quantity:      dto.quantity,
      },
    })

    return {
      item_id:       dto.item_id,
      from_warehouse: dto.from_warehouse,
      to_warehouse:   dto.to_warehouse,
      quantity:       dto.quantity,
    }
  },
}