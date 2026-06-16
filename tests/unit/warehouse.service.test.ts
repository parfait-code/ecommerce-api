import { warehouseService } from '../../src/modules/warehouses/warehouse.service'
import { warehouseRepository } from '../../src/modules/warehouses/warehouse.repository'
import { cache } from '../../src/shared/utils/cache'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/warehouses/warehouse.repository')
jest.mock('../../src/shared/utils/cache')

const mockWarehouseRepository = warehouseRepository as jest.Mocked<typeof warehouseRepository>
const mockCache = cache as jest.Mocked<typeof cache>

const mockWarehouse = {
  id: 'warehouse-cuid-1',
  name: 'Main Warehouse',
  location: 'Yaoundé, CM',
  capacity: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('WarehouseService', () => {
  beforeEach(() => {
    mockCache.get.mockResolvedValue(null)
    mockCache.set.mockResolvedValue(undefined)
    mockCache.del.mockResolvedValue(undefined)
  })

  describe('getAll', () => {
    it('should return all warehouses', async () => {
      mockWarehouseRepository.findAll.mockResolvedValue([mockWarehouse])

      const result = (await warehouseService.getAll()) as any[]

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(mockWarehouse)
      expect(mockCache.set).toHaveBeenCalledWith('warehouses:all', [mockWarehouse])
    })

    it('should return cached warehouses if available', async () => {
      mockCache.get.mockResolvedValue([mockWarehouse])

      const result = (await warehouseService.getAll()) as any[]

      expect(mockWarehouseRepository.findAll).not.toHaveBeenCalled()
      expect(result).toEqual([mockWarehouse])
    })
  })

  describe('getById', () => {
    it('should return warehouse if found', async () => {
      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse)

      const result = await warehouseService.getById('warehouse-cuid-1')

      expect(result).toEqual(mockWarehouse)
      expect(mockCache.set).toHaveBeenCalledWith(
        'warehouses:warehouse-cuid-1',
        mockWarehouse,
      )
    })

    it('should return cached warehouse if available', async () => {
      mockCache.get.mockResolvedValue(mockWarehouse)

      const result = await warehouseService.getById('warehouse-cuid-1')

      expect(mockWarehouseRepository.findById).not.toHaveBeenCalled()
      expect(result).toEqual(mockWarehouse)
    })

    it('should throw 404 if warehouse not found', async () => {
      mockWarehouseRepository.findById.mockResolvedValue(null)

      await expect(warehouseService.getById('nonexistent')).rejects.toThrow(
        new AppError('Warehouse not found', 404),
      )
    })
  })

  describe('create', () => {
    it('should create a warehouse and invalidate cache', async () => {
      mockWarehouseRepository.create.mockResolvedValue(mockWarehouse)

      const result = await warehouseService.create({
        name: 'Main Warehouse',
        location: 'Yaoundé, CM',
        capacity: 1000,
      })

      expect(result).toEqual(mockWarehouse)
      expect(mockCache.del).toHaveBeenCalledWith('warehouses:all')
    })
  })

  describe('update', () => {
    it('should update warehouse and invalidate cache', async () => {
      const updated = { ...mockWarehouse, name: 'Updated Warehouse' }
      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse)
      mockWarehouseRepository.update.mockResolvedValue(updated)

      const result = await warehouseService.update('warehouse-cuid-1', {
        name: 'Updated Warehouse',
      })

      expect(result).toEqual(updated)
      expect(mockCache.del).toHaveBeenCalledWith(
        'warehouses:warehouse-cuid-1',
        'warehouses:all',
      )
    })

    it('should throw 404 if warehouse not found', async () => {
      mockWarehouseRepository.findById.mockResolvedValue(null)

      await expect(
        warehouseService.update('nonexistent', { name: 'X' }),
      ).rejects.toThrow(new AppError('Warehouse not found', 404))
    })
  })

  describe('delete', () => {
    it('should delete warehouse and invalidate cache', async () => {
      mockWarehouseRepository.findById.mockResolvedValue(mockWarehouse)
      mockWarehouseRepository.delete.mockResolvedValue(mockWarehouse)

      const result = await warehouseService.delete('warehouse-cuid-1')

      expect(mockWarehouseRepository.delete).toHaveBeenCalledWith('warehouse-cuid-1')
      expect(result).toEqual({ message: 'Warehouse deleted successfully' })
      expect(mockCache.del).toHaveBeenCalledWith(
        'warehouses:warehouse-cuid-1',
        'warehouses:all',
      )
    })

    it('should throw 404 if warehouse not found', async () => {
      mockWarehouseRepository.findById.mockResolvedValue(null)

      await expect(warehouseService.delete('nonexistent')).rejects.toThrow(
        new AppError('Warehouse not found', 404),
      )
    })
  })
})