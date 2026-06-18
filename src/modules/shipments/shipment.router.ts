import { Router } from 'express'
import { shipmentController } from './shipment.controller'
import { authGuard } from '../../shared/middlewares/auth-guard'
import { adminGuard } from '../../shared/middlewares/admin-guard'
import { validate } from '../../shared/middlewares/validate'
import {
  createShipmentSchema,
  trackingEventSchema,
  shippingCostSchema,
  createPickupRequestSchema,
} from './shipment.schema'

const router = Router()

router.post('/shipments/cost', validate(shippingCostSchema), shipmentController.calculateCost)
router.post('/shipments', authGuard, validate(createShipmentSchema), shipmentController.create)
router.get('/shipments/:shipmentId', authGuard, shipmentController.getById)
router.get('/shipments', authGuard, adminGuard, shipmentController.getAll)
router.post('/shipments/:shipmentId/track', authGuard, validate(trackingEventSchema), shipmentController.addTrackingEvent)
router.get('/shipments/:shipmentId/track', authGuard, shipmentController.getTracking)
router.post('/shipments/:shipmentId/cancel', authGuard, shipmentController.cancel)
router.get('/labels/:shipmentId', authGuard, shipmentController.getLabel)
router.post('/pickup-requests', authGuard, validate(createPickupRequestSchema), shipmentController.createPickupRequest)
router.get('/pickup-requests/:requestId', authGuard, shipmentController.getPickupRequest)
router.post('/pickup-requests/:requestId/cancel', authGuard, shipmentController.cancelPickupRequest)

export default router