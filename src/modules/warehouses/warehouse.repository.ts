import { prisma } from '../../shared/config/database'
import { CreateWarehouseDto, UpdateWarehouseDto } from './warehouse.schema'

export const warehouseRepository = {
  findAll: () =>
    prisma.warehouse.findMany({ orderBy: { createdAt: 'desc' } }),

  findById: (id: string) =>
    prisma.warehouse.findUnique({ where: { id } }),

  create: (data: CreateWarehouseDto) =>
    prisma.warehouse.create({ data }),

  update: (id: string, data: UpdateWarehouseDto) =>
    prisma.warehouse.update({ where: { id }, data }),

  delete: (id: string) =>
    prisma.warehouse.delete({ where: { id } }),
}