import { shipmentService } from '../../src/modules/shipments/shipment.service'
import { shipmentRepository, pickupRepository } from '../../src/modules/shipments/shipment.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/shipments/shipment.repository')

const mockShipmentRepository = shipmentRepository as jest.Mocked<typeof shipmentRepository>
const mockPickupRepository = pickupRepository as jest.Mocked<typeof pickupRepository>

const mockShipment = {
  id: 'shipment-cuid-1',
  orderId: null,
  senderName: 'Alice',
  senderAddress: '1 Rue A, Yaoundé',
  recipientName: 'Bob',
  recipientAddress: '2 Rue B, Douala',
  weight: 2.5,
  dimensions: null,
  status: 'PENDING' as const,
  trackingNumber: 'ABC123XYZ',
  estimatedDeliveryDate: '2026-06-23',
  createdAt: new Date(),
  updatedAt: new Date(),
  trackingEvents: [],
  label: null,
}

const mockPickupRequest = {
  id: 'pickup-cuid-1',
  userId: 1,
  pickupDate: '2026-06-20',
  pickupAddress: '1 Rue A, Yaoundé',
  status: 'PENDING' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockCreateDto = {
  sender_name: 'Alice',
  sender_address: '1 Rue A, Yaoundé',
  recipient_name: 'Bob',
  recipient_address: '2 Rue B, Douala',
  weight: 2.5,
}

describe('ShipmentService', () => {
  describe('calculateCost', () => {
    it('should calculate cost based on weight', () => {
      const result = shipmentService.calculateCost({
        origin: 'Yaoundé',
        destination: 'Douala',
        weight: 10,
      })

      // baseCost(5) + weight(10) * 0.1 = 6
      expect(result.cost).toBe(6)
      expect(result.currency).toBe('XAF')
    })

    it('should return base cost for minimal weight', () => {
      const result = shipmentService.calculateCost({
        origin: 'Yaoundé',
        destination: 'Douala',
        weight: 0.1,
      })

      // baseCost(5) + 0.1 * 0.1 = 5.01
      expect(result.cost).toBe(5.01)
      expect(result.currency).toBe('XAF')
    })
  })

  describe('create', () => {
    it('should create a shipment with tracking number and estimated delivery', async () => {
      mockShipmentRepository.create.mockResolvedValue(mockShipment)

      const result = await shipmentService.create(mockCreateDto)

      expect(mockShipmentRepository.create).toHaveBeenCalledWith(
        mockCreateDto,
        expect.any(String), // trackingNumber
        expect.any(String), // estimatedDeliveryDate
      )
      expect(result).toEqual(mockShipment)
    })
  })

  describe('getById', () => {
    it('should return shipment if found', async () => {
      mockShipmentRepository.findById.mockResolvedValue(mockShipment)

      const result = await shipmentService.getById('shipment-cuid-1')

      expect(result).toEqual(mockShipment)
    })

    it('should throw 404 if shipment not found', async () => {
      mockShipmentRepository.findById.mockResolvedValue(null)

      await expect(shipmentService.getById('nonexistent')).rejects.toThrow(
        new AppError('Shipment not found', 404),
      )
    })
  })

  describe('addTrackingEvent', () => {
    it('should add a tracking event and update status', async () => {
      const updatedShipment = {
        ...mockShipment,
        status: 'IN_TRANSIT' as const,
        trackingEvents: [
          { id: 'event-1', shipmentId: 'shipment-cuid-1', status: 'IN_TRANSIT', location: 'Yaoundé', createdAt: new Date() },
        ],
      }
      mockShipmentRepository.findById
        .mockResolvedValueOnce(mockShipment)
        .mockResolvedValueOnce(updatedShipment)
      mockShipmentRepository.addTrackingEvent.mockResolvedValue({
        id: 'event-1',
        shipmentId: 'shipment-cuid-1',
        status: 'IN_TRANSIT',
        location: 'Yaoundé',
        createdAt: new Date(),
      })
      mockShipmentRepository.updateStatus.mockResolvedValue({
        ...mockShipment,
        status: 'IN_TRANSIT',
      })

      const result = await shipmentService.addTrackingEvent('shipment-cuid-1', {
        status: 'IN_TRANSIT',
        location: 'Yaoundé',
      })

      expect(mockShipmentRepository.addTrackingEvent).toHaveBeenCalledWith('shipment-cuid-1', {
        status: 'IN_TRANSIT',
        location: 'Yaoundé',
      })
      expect(mockShipmentRepository.updateStatus).toHaveBeenCalledWith('shipment-cuid-1', 'IN_TRANSIT')
      expect(result).toEqual(updatedShipment)
    })

    it('should throw 404 if shipment not found', async () => {
      mockShipmentRepository.findById.mockResolvedValue(null)

      await expect(
        shipmentService.addTrackingEvent('nonexistent', { status: 'IN_TRANSIT' }),
      ).rejects.toThrow(new AppError('Shipment not found', 404))
    })
  })

  describe('getTracking', () => {
    it('should return tracking info with current status and events', async () => {
      const shipmentWithEvents = {
        ...mockShipment,
        status: 'IN_TRANSIT' as const,
        trackingEvents: [
          { id: 'event-1', shipmentId: 'shipment-cuid-1', status: 'IN_TRANSIT', location: 'Yaoundé', createdAt: new Date() },
        ],
      }
      mockShipmentRepository.findById.mockResolvedValue(shipmentWithEvents)

      const result = await shipmentService.getTracking('shipment-cuid-1')

      expect(result.current_status).toBe('IN_TRANSIT')
      expect(result.current_location).toBe('Yaoundé')
      expect(result.updates).toHaveLength(1)
    })

    it('should return null location if no tracking events', async () => {
      mockShipmentRepository.findById.mockResolvedValue(mockShipment)

      const result = await shipmentService.getTracking('shipment-cuid-1')

      expect(result.current_location).toBeNull()
      expect(result.updates).toHaveLength(0)
    })

    it('should throw 404 if shipment not found', async () => {
      mockShipmentRepository.findById.mockResolvedValue(null)

      await expect(shipmentService.getTracking('nonexistent')).rejects.toThrow(
        new AppError('Shipment not found', 404),
      )
    })
  })

  describe('cancel', () => {
    it('should cancel a shipment', async () => {
      const cancelled = { ...mockShipment, status: 'CANCELLED' as const }
      mockShipmentRepository.findById.mockResolvedValue(mockShipment)
      mockShipmentRepository.updateStatus.mockResolvedValue(cancelled)

      const result = await shipmentService.cancel('shipment-cuid-1')

      expect(mockShipmentRepository.updateStatus).toHaveBeenCalledWith('shipment-cuid-1', 'CANCELLED')
      expect(result.status).toBe('CANCELLED')
    })

    it('should throw 400 if shipment already cancelled', async () => {
      mockShipmentRepository.findById.mockResolvedValue({
        ...mockShipment,
        status: 'CANCELLED',
      })

      await expect(shipmentService.cancel('shipment-cuid-1')).rejects.toThrow(
        new AppError('Shipment already cancelled', 400),
      )
    })

    it('should throw 404 if shipment not found', async () => {
      mockShipmentRepository.findById.mockResolvedValue(null)

      await expect(shipmentService.cancel('nonexistent')).rejects.toThrow(
        new AppError('Shipment not found', 404),
      )
    })
  })

  describe('getLabel', () => {
    it('should return existing label if found', async () => {
      const label = { id: 'label-1', shipmentId: 'shipment-cuid-1', labelUrl: 'https://labels.ecommerce-api.com/shipment-cuid-1.pdf', createdAt: new Date() }
      mockShipmentRepository.findById.mockResolvedValue(mockShipment)
      mockShipmentRepository.findLabel.mockResolvedValue(label)

      const result = await shipmentService.getLabel('shipment-cuid-1')

      expect(mockShipmentRepository.createLabel).not.toHaveBeenCalled()
      expect(result).toEqual({ label_id: 'label-1', label_url: label.labelUrl })
    })

    it('should create label if not found', async () => {
      const label = { id: 'label-1', shipmentId: 'shipment-cuid-1', labelUrl: 'https://labels.ecommerce-api.com/shipment-cuid-1.pdf', createdAt: new Date() }
      mockShipmentRepository.findById.mockResolvedValue(mockShipment)
      mockShipmentRepository.findLabel.mockResolvedValue(null)
      mockShipmentRepository.createLabel.mockResolvedValue(label)

      const result = await shipmentService.getLabel('shipment-cuid-1')

      expect(mockShipmentRepository.createLabel).toHaveBeenCalledWith(
        'shipment-cuid-1',
        expect.stringContaining('shipment-cuid-1'),
      )
      expect(result.label_id).toBe('label-1')
    })

    it('should throw 404 if shipment not found', async () => {
      mockShipmentRepository.findById.mockResolvedValue(null)

      await expect(shipmentService.getLabel('nonexistent')).rejects.toThrow(
        new AppError('Shipment not found', 404),
      )
    })
  })

  describe('createPickupRequest', () => {
    it('should create a pickup request', async () => {
      mockPickupRepository.create.mockResolvedValue(mockPickupRequest)

      const result = await shipmentService.createPickupRequest(1, {
        pickup_date: '2026-06-20',
        pickup_address: '1 Rue A, Yaoundé',
      })

      expect(mockPickupRepository.create).toHaveBeenCalledWith(1, {
        pickupDate: '2026-06-20',
        pickupAddress: '1 Rue A, Yaoundé',
      })
      expect(result).toEqual(mockPickupRequest)
    })
  })

  describe('getPickupRequest', () => {
    it('should return pickup request if found', async () => {
      mockPickupRepository.findById.mockResolvedValue(mockPickupRequest)

      const result = await shipmentService.getPickupRequest('pickup-cuid-1')

      expect(result).toEqual(mockPickupRequest)
    })

    it('should throw 404 if pickup request not found', async () => {
      mockPickupRepository.findById.mockResolvedValue(null)

      await expect(shipmentService.getPickupRequest('nonexistent')).rejects.toThrow(
        new AppError('Pickup request not found', 404),
      )
    })
  })

  describe('cancelPickupRequest', () => {
    it('should cancel a pickup request', async () => {
      const cancelled = { ...mockPickupRequest, status: 'CANCELLED' as const }
      mockPickupRepository.findById.mockResolvedValue(mockPickupRequest)
      mockPickupRepository.cancel.mockResolvedValue(cancelled)

      const result = await shipmentService.cancelPickupRequest('pickup-cuid-1', 1)

      expect(mockPickupRepository.cancel).toHaveBeenCalledWith('pickup-cuid-1')
      expect(result.status).toBe('CANCELLED')
    })

    it('should throw 404 if pickup request not found', async () => {
      mockPickupRepository.findById.mockResolvedValue(null)

      await expect(
        shipmentService.cancelPickupRequest('nonexistent', 1),
      ).rejects.toThrow(new AppError('Pickup request not found', 404))
    })

    it('should throw 403 if user does not own the pickup request', async () => {
      mockPickupRepository.findById.mockResolvedValue(mockPickupRequest) // userId: 1

      await expect(
        shipmentService.cancelPickupRequest('pickup-cuid-1', 99),
      ).rejects.toThrow(new AppError('Forbidden', 403))
    })

    it('should throw 400 if pickup request already cancelled', async () => {
      mockPickupRepository.findById.mockResolvedValue({
        ...mockPickupRequest,
        status: 'CANCELLED',
      })

      await expect(
        shipmentService.cancelPickupRequest('pickup-cuid-1', 1),
      ).rejects.toThrow(new AppError('Pickup request already cancelled', 400))
    })
  })
})