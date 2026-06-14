import { warehouseRepository } from './warehouse.repository'
import { CreateWarehouseDto, UpdateWarehouseDto } from './warehouse.schema'
import { AppError } from '../../shared/utils/app-error'

export const warehouseService = {
  getAll: () => warehouseRepository.findAll(),

  getById: async (id: string) => {
    const warehouse = await warehouseRepository.findById(id)
    if (!warehouse) throw new AppError('Warehouse not found', 404)
    return warehouse
  },

  create: (dto: CreateWarehouseDto) => warehouseRepository.create(dto),

  update: async (id: string, dto: UpdateWarehouseDto) => {
    const warehouse = await warehouseRepository.findById(id)
    if (!warehouse) throw new AppError('Warehouse not found', 404)
    return warehouseRepository.update(id, dto)
  },

  delete: async (id: string) => {
    const warehouse = await warehouseRepository.findById(id)
    if (!warehouse) throw new AppError('Warehouse not found', 404)
    await warehouseRepository.delete(id)
    return { message: 'Warehouse deleted successfully' }
  },
}