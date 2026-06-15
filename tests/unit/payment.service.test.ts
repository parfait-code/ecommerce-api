import { paymentService } from '../../src/modules/payments/payment.service'
import { paymentRepository } from '../../src/modules/payments/payment.repository'
import { orderRepository } from '../../src/modules/orders/order.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/payments/payment.repository')
jest.mock('../../src/modules/orders/order.repository')

const mockPaymentRepository = paymentRepository as jest.Mocked<typeof paymentRepository>
const mockOrderRepository = orderRepository as jest.Mocked<typeof orderRepository>

const mockOrder = {
  id: 'order-cuid-1',
  userId: 1,
  status: 'PENDING',
  shippingAddress: { street: '123 Main St', city: 'Yaoundé', country: 'CM', postalCode: '00000' },
  billingAddress: null,
  paymentMethodId: null,
  notes: null,
  couponCode: null,
  totalAmount: 150.00,
  discountedAmount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
  user: { id: 1, username: 'testuser', email: 'test@example.com' },
}

const mockPayment = {
  id: 'payment-cuid-1',
  orderId: 'order-cuid-1',
  userId: 1,
  method: 'CASH_ON_DELIVERY' as const,
  status: 'PENDING' as const,
  amount: 150.00,
  currency: 'XAF',
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  order: mockOrder,
  user: { id: 1, username: 'testuser', email: 'test@example.com' },
}

describe('PaymentService', () => {
  describe('getAvailableMethods', () => {
    it('should return all payment methods', () => {
      const result = paymentService.getAvailableMethods()

      expect(result).toHaveLength(4)
      expect(result.map((m) => m.id)).toEqual([
        'CASH_ON_DELIVERY',
        'PAYPAL',
        'STRIPE',
        'CINETPAY',
      ])
    })

    it('should mark only CASH_ON_DELIVERY as available', () => {
      const result = paymentService.getAvailableMethods()

      const available = result.filter((m) => m.available)
      const unavailable = result.filter((m) => !m.available)

      expect(available).toHaveLength(1)
      expect(available[0].id).toBe('CASH_ON_DELIVERY')
      expect(unavailable).toHaveLength(3)
    })
  })

  describe('create', () => {
    it('should create a payment with CASH_ON_DELIVERY', async () => {
      mockOrderRepository.findById.mockResolvedValue(mockOrder)
      mockPaymentRepository.create.mockResolvedValue(mockPayment)
      mockOrderRepository.updateStatus.mockResolvedValue({ ...mockOrder, status: 'CONFIRMED' })

      const result = await paymentService.create(1, {
        order_id: 'order-cuid-1',
        method: 'CASH_ON_DELIVERY',
        currency: 'XAF',
      })

      expect(mockPaymentRepository.create).toHaveBeenCalledWith({
        orderId: 'order-cuid-1',
        userId: 1,
        method: 'CASH_ON_DELIVERY',
        amount: 150.00,
        currency: 'XAF',
        notes: undefined,
      })
      expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith('order-cuid-1', 'CONFIRMED')
      expect(result).toEqual(mockPayment)
    })

    it('should throw 503 if payment method is unavailable (STRIPE)', async () => {
      await expect(
        paymentService.create(1, {
          order_id: 'order-cuid-1',
          method: 'STRIPE',
          currency: 'XAF',
        }),
      ).rejects.toThrow(new AppError('Stripe payment is not available yet. Coming soon.', 503))
    })

    it('should throw 503 if payment method is unavailable (PAYPAL)', async () => {
      await expect(
        paymentService.create(1, {
          order_id: 'order-cuid-1',
          method: 'PAYPAL',
          currency: 'XAF',
        }),
      ).rejects.toThrow(new AppError('PayPal payment is not available yet. Coming soon.', 503))
    })

    it('should throw 503 if payment method is unavailable (CINETPAY)', async () => {
      await expect(
        paymentService.create(1, {
          order_id: 'order-cuid-1',
          method: 'CINETPAY',
          currency: 'XAF',
        }),
      ).rejects.toThrow(new AppError('CinetPay payment is not available yet. Coming soon.', 503))
    })

    it('should throw 404 if order not found', async () => {
      mockOrderRepository.findById.mockResolvedValue(null)

      await expect(
        paymentService.create(1, {
          order_id: 'nonexistent',
          method: 'CASH_ON_DELIVERY',
          currency: 'XAF',
        }),
      ).rejects.toThrow(new AppError('Order not found', 404))
    })

    it('should throw 403 if user does not own the order', async () => {
      mockOrderRepository.findById.mockResolvedValue(mockOrder) // userId: 1

      await expect(
        paymentService.create(99, {
          order_id: 'order-cuid-1',
          method: 'CASH_ON_DELIVERY',
          currency: 'XAF',
        }),
      ).rejects.toThrow(new AppError('Forbidden', 403))
    })
  })

  describe('getById', () => {
    it('should return payment if found', async () => {
      mockPaymentRepository.findById.mockResolvedValue(mockPayment)

      const result = await paymentService.getById('payment-cuid-1')

      expect(result).toEqual(mockPayment)
    })

    it('should throw 404 if payment not found', async () => {
      mockPaymentRepository.findById.mockResolvedValue(null)

      await expect(paymentService.getById('nonexistent')).rejects.toThrow(
        new AppError('Payment not found', 404),
      )
    })
  })

  describe('getByOrderId', () => {
    it('should return all payments for an order', async () => {
      mockPaymentRepository.findByOrderId.mockResolvedValue([mockPayment])

      const result = await paymentService.getByOrderId('order-cuid-1')

      expect(result).toHaveLength(1)
      expect(result[0].orderId).toBe('order-cuid-1')
    })

    it('should return empty array if no payments found', async () => {
      mockPaymentRepository.findByOrderId.mockResolvedValue([])

      const result = await paymentService.getByOrderId('order-cuid-1')

      expect(result).toHaveLength(0)
    })
  })
})
