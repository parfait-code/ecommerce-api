import { shipmentRepository, pickupRepository } from './shipment.repository'
import { CreateShipmentDto, TrackingEventDto, ShippingCostDto, CreatePickupRequestDto } from './shipment.schema'
import { AppError }      from '../../shared/utils/app-error'
import { businessLogger } from '../../shared/logger'

const generateTrackingNumber = () =>
  Math.random().toString(36).substring(2, 12).toUpperCase()

const generateEstimatedDelivery = () => {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().split('T')[0]
}

export const shipmentService = {
  calculateCost: (dto: ShippingCostDto) => {
    const baseCost  = 5
    const weightCost = dto.weight * 0.1
    const cost = baseCost + weightCost
    return { cost: Math.round(cost * 100) / 100, currency: 'XAF' }
  },

  create: async (dto: CreateShipmentDto) => {
    const shipment = await shipmentRepository.create(
      dto,
      generateTrackingNumber(),
      generateEstimatedDelivery(),
    )

    businessLogger.log('SHIPMENT_CREATED', {
      service: 'shipments',
      actor:   { userId: null, role: 'CUSTOMER' },
      target:  { shipmentId: shipment.id },
      metadata: {
        trackingNumber:        shipment.trackingNumber,
        estimatedDeliveryDate: shipment.estimatedDeliveryDate,
        weight:                dto.weight,
      },
    })

    return shipment
  },

  getById: async (id: string) => {
    const shipment = await shipmentRepository.findById(id)
    if (!shipment) throw new AppError('Shipment not found', 404)
    return shipment
  },

  addTrackingEvent: async (id: string, dto: TrackingEventDto) => {
    const shipment = await shipmentRepository.findById(id)
    if (!shipment) throw new AppError('Shipment not found', 404)

    await shipmentRepository.addTrackingEvent(id, dto)
    await shipmentRepository.updateStatus(
      id,
      dto.status as 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED',
    )

    const updated = await shipmentRepository.findById(id)

    if (dto.status === 'DELIVERED') {
      businessLogger.log('SHIPMENT_DELIVERED', {
        service: 'shipments',
        actor:   { userId: null, role: 'SYSTEM' },
        target:  { shipmentId: id },
        metadata: { location: dto.location },
      })
    }

    return updated
  },

  getTracking: async (id: string) => {
    const shipment = await shipmentRepository.findById(id)
    if (!shipment) throw new AppError('Shipment not found', 404)
    return {
      current_status:   shipment.status,
      current_location: shipment.trackingEvents[0]?.location ?? null,
      updates:          shipment.trackingEvents,
    }
  },

  cancel: async (id: string) => {
    const shipment = await shipmentRepository.findById(id)
    if (!shipment) throw new AppError('Shipment not found', 404)
    if (shipment.status === 'CANCELLED') throw new AppError('Shipment already cancelled', 400)

    const cancelled = await shipmentRepository.updateStatus(id, 'CANCELLED')

    businessLogger.log('SHIPMENT_FAILED', {
      service: 'shipments',
      actor:   { userId: null, role: 'CUSTOMER' },
      target:  { shipmentId: id },
      metadata: { reason: 'Cancelled by user' },
    })

    return cancelled
  },

  getLabel: async (shipmentId: string) => {
    const shipment = await shipmentRepository.findById(shipmentId)
    if (!shipment) throw new AppError('Shipment not found', 404)

    let label = await shipmentRepository.findLabel(shipmentId)
    if (!label) {
      label = await shipmentRepository.createLabel(
        shipmentId,
        `https://labels.ecommerce-api.com/${shipmentId}.pdf`,
      )
    }
    return { label_id: label.id, label_url: label.labelUrl }
  },

  createPickupRequest: (userId: number, dto: CreatePickupRequestDto) =>
    pickupRepository.create(userId, {
      pickupDate:    dto.pickup_date,
      pickupAddress: dto.pickup_address,
    }),

  getPickupRequest: async (id: string) => {
    const request = await pickupRepository.findById(id)
    if (!request) throw new AppError('Pickup request not found', 404)
    return request
  },

  cancelPickupRequest: async (id: string, userId: number) => {
    const request = await pickupRepository.findById(id)
    if (!request) throw new AppError('Pickup request not found', 404)
    if (request.userId !== userId) throw new AppError('Forbidden', 403)
    if (request.status === 'CANCELLED') throw new AppError('Pickup request already cancelled', 400)
    return pickupRepository.cancel(id)
  },
}