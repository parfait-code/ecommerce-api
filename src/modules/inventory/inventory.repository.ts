import { prisma } from '../../shared/config/database'
import { CreateInventoryDto, UpdateInventoryDto } from './inventory.schema'

const inventoryInclude = {
  product: true,
  warehouse: true,
}

export const inventoryRepository = {
  findAll: (query: { category?: string; location?: string }) =>
    prisma.inventory.findMany({
      where: {
        ...(query.category && { product: { category: query.category } }),
        ...(query.location && { warehouse: { location: { contains: query.location } } }),
      },
      include: inventoryInclude,
      orderBy: { createdAt: 'desc' },
    }),

  findById: (id: string) =>
    prisma.inventory.findUnique({ where: { id }, include: inventoryInclude }),

  findByProductAndWarehouse: (productId: number, warehouseId: string) =>
    prisma.inventory.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
      include: inventoryInclude,
    }),

  findLowStock: (threshold: number) =>
    prisma.inventory.findMany({
      where: { quantity: { lte: threshold, gt: 0 } },
      include: inventoryInclude,
    }),

  findOutOfStock: () =>
    prisma.inventory.findMany({
      where: { quantity: 0 },
      include: inventoryInclude,
    }),

  search: (keyword: string) =>
    prisma.inventory.findMany({
      where: { product: { name: { contains: keyword, mode: 'insensitive' } } },
      include: inventoryInclude,
    }),

  create: (data: CreateInventoryDto) =>
    prisma.inventory.create({
      data: {
        productId: data.product_id,
        warehouseId: data.warehouse_id,
        quantity: data.quantity,
      },
      include: inventoryInclude,
    }),

  update: (id: string, data: UpdateInventoryDto) =>
    prisma.inventory.update({
      where: { id },
      data: {
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.warehouse_id && { warehouseId: data.warehouse_id }),
      },
      include: inventoryInclude,
    }),

  delete: (id: string) =>
    prisma.inventory.delete({ where: { id } }),

  decrementQuantity: (id: string, quantity: number) =>
    prisma.inventory.update({
      where: { id },
      data: { quantity: { decrement: quantity } },
    }),

  incrementQuantity: (id: string, quantity: number) =>
    prisma.inventory.update({
      where: { id },
      data: { quantity: { increment: quantity } },
    }),
}