// tests/unit/order.service.test.ts
import { orderService } from '../../src/modules/orders/order.service'
import { orderRepository } from '../../src/modules/orders/order.repository'
import { productRepository } from '../../src/modules/products/product.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/orders/order.repository')
jest.mock('../../src/modules/products/product.repository')
jest.mock('../../src/shared/utils/cache', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
  },
}))

const mockOrderRepository = orderRepository as jest.Mocked<typeof orderRepository>
const mockProductRepository = productRepository as jest.Mocked<typeof productRepository>

const mockCategory = { id: 'cat-1', name: 'Test', slug: 'test' }

const mockProduct = {
  id: 1,
  name: 'Test Product',
  description: null,
  price: 75.00,
  categoryId: 'cat-1',
  category: mockCategory,
  stock: 50,
  images: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

const shippingAddress = {
  street: '123 Rue Principale',
  city: 'Yaoundé',
  country: 'CM',
  postalCode: '00000',
}

const mockOrder = {
  id: 'order-cuid-1',
  userId: 1,
  status: 'PENDING',
  shippingAddress: shippingAddress as unknown as import('@prisma/client').Prisma.JsonValue,
  billingAddress: null,
  paymentMethodId: null,
  notes: null,
  couponCode: null,
  couponCodeId: null,
  appliedCoupon: null,
  totalAmount: 150.00,
  discountedAmount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: 'oi-1',
      orderId: 'order-cuid-1',
      productId: 1,
      quantity: 2,
      price: 75.00,
      product: { id: 1, name: 'Test Product', images: [] },
    },
  ],
  user: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  },
}

describe('OrderService', () => {
  describe('create', () => {
    it('should create an order and compute total from product prices', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      mockOrderRepository.create.mockResolvedValue(mockOrder)

      const result = await orderService.create(1, {
        items: [{ id: '1', quantity: 2 }],
        shippingAddress,
      })

      expect(mockOrderRepository.create).toHaveBeenCalledWith(
        1,
        expect.anything(),
        150.00,
        [{ productId: 1, quantity: 2, price: 75.00 }],
        undefined,
      )
      expect(result).toEqual(mockOrder)
    })

    it('should throw 404 if a product is not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null)

      await expect(
        orderService.create(1, {
          items: [{ id: '999', quantity: 1 }],
          shippingAddress,
        }),
      ).rejects.toThrow(new AppError('Product 999 not found', 404))
    })
  })

  describe('getAll', () => {
    it('should return paginated orders', async () => {
      mockOrderRepository.findAll.mockResolvedValue([[mockOrder], 1])

      const result = await orderService.getAll({ page: '1', limit: '20' })
      const paginated = result as unknown as { items: unknown[]; total: number; totalPages: number }

      expect(paginated.items).toHaveLength(1)
      expect(paginated.total).toBe(1)
      expect(paginated.totalPages).toBe(1)
    })

    it('should filter by status', async () => {
      mockOrderRepository.findAll.mockResolvedValue([[mockOrder], 1])
      await orderService.getAll({ status: 'PENDING' })
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING' }),
      )
    })
  })

  describe('getById', () => {
    it('should return order if found', async () => {
      mockOrderRepository.findById.mockResolvedValue(mockOrder)
      const result = await orderService.getById('order-cuid-1')
      expect(result).toEqual(mockOrder)
    })

    it('should throw 404 if order not found', async () => {
      mockOrderRepository.findById.mockResolvedValue(null)
      await expect(orderService.getById('nonexistent')).rejects.toThrow(
        new AppError('Order not found', 404),
      )
    })
  })

  describe('update', () => {
    it('should update order notes', async () => {
      const updated = { ...mockOrder, notes: 'Deliver in the morning' }
      mockOrderRepository.findById.mockResolvedValue(mockOrder)
      mockOrderRepository.update.mockResolvedValue(updated)

      const result = await orderService.update('order-cuid-1', { notes: 'Deliver in the morning' })
      const typed = result as unknown as { notes: string }
      expect(typed.notes).toBe('Deliver in the morning')
    })

    it('should throw 404 if order not found', async () => {
      mockOrderRepository.findById.mockResolvedValue(null)
      await expect(orderService.update('nonexistent', { notes: 'x' })).rejects.toThrow(
        new AppError('Order not found', 404),
      )
    })
  })

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const updated = { ...mockOrder, status: 'CONFIRMED' }
      mockOrderRepository.findById.mockResolvedValue(mockOrder)
      mockOrderRepository.updateStatus.mockResolvedValue(updated)

      const result = await orderService.updateStatus('order-cuid-1', { status: 'CONFIRMED' })
      const typed = result as unknown as { status: string }
      expect(typed.status).toBe('CONFIRMED')
    })

    it('should throw 404 if order not found', async () => {
      mockOrderRepository.findById.mockResolvedValue(null)
      await expect(
        orderService.updateStatus('nonexistent', { status: 'CONFIRMED' }),
      ).rejects.toThrow(new AppError('Order not found', 404))
    })
  })

  describe('delete', () => {
    it('should cancel order and return message', async () => {
      mockOrderRepository.findById.mockResolvedValue(mockOrder)
      mockOrderRepository.delete.mockResolvedValue(mockOrder)

      const result = await orderService.delete('order-cuid-1')
      expect(result).toEqual({ message: 'Order cancelled successfully' })
    })

    it('should throw 404 if order not found', async () => {
      mockOrderRepository.findById.mockResolvedValue(null)
      await expect(orderService.delete('nonexistent')).rejects.toThrow(
        new AppError('Order not found', 404),
      )
    })
  })

  describe('getByUser', () => {
    it('should return paginated orders for a user', async () => {
      mockOrderRepository.findByUser.mockResolvedValue([[mockOrder], 1])

      const result = await orderService.getByUser(1, { page: '1', limit: '10' })
      const paginated = result as unknown as { items: unknown[]; total: number; totalPages: number }

      expect(paginated.items).toHaveLength(1)
      expect(paginated.total).toBe(1)
      expect(mockOrderRepository.findByUser).toHaveBeenCalledWith(1, { page: '1', limit: '10' })
    })
  })
})