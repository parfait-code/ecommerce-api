// tests/unit/dashboard.service.test.ts
import { dashboardService } from '../../src/modules/dashboard/dashboard.service'

// Mock complet de Prisma — on injecte des valeurs contrôlées
jest.mock('../../src/shared/config/database', () => ({
  prisma: {
    product: {
      count: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    payment: {
      aggregate: jest.fn(),
    },
    inventory: {
      count: jest.fn(),
    },
    shipment: {
      count: jest.fn(),
    },
    promotion: {
      count: jest.fn(),
    },
    couponCode: {
      aggregate: jest.fn(),
    },
  },
}))

import { prisma } from '../../src/shared/config/database'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('DashboardService', () => {
  describe('getStats', () => {
    beforeEach(() => {
      // Valeurs par défaut pour tous les appels Promise.all
      ;(mockPrisma.product.count as jest.Mock)
        .mockResolvedValueOnce(248)   // totalProducts
        .mockResolvedValueOnce(12)    // addedThisMonth

      ;(mockPrisma.order.count as jest.Mock)
        .mockResolvedValueOnce(1284)  // totalOrders
        .mockResolvedValueOnce(100)   // ordersThisMonth
        .mockResolvedValueOnce(80)    // ordersLastMonth

      ;(mockPrisma.user.count as jest.Mock)
        .mockResolvedValueOnce(3429)  // totalUsers

      ;(mockPrisma.payment.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amount: 420000 } })  // paymentsThisMonth
        .mockResolvedValueOnce({ _sum: { amount: 390000 } })  // paymentsLastMonth
        .mockResolvedValueOnce({ _sum: { amount: 50000 } })   // coupon payments (not used directly)

      ;(mockPrisma.inventory.count as jest.Mock)
        .mockResolvedValueOnce(14)    // lowStockCount

      ;(mockPrisma.shipment.count as jest.Mock)
        .mockResolvedValueOnce(67)    // shipmentsInProgress
        .mockResolvedValueOnce(55)    // shipmentsLastMonth

      ;(mockPrisma.promotion.count as jest.Mock)
        .mockResolvedValueOnce(3)     // activePromotions

      ;(mockPrisma.couponCode.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { usedCount: 42 } })   // couponsUsedThisMonth
    })

    it('should return stats with correct structure', async () => {
      const result = await dashboardService.getStats()

      expect(result).toHaveProperty('products')
      expect(result).toHaveProperty('orders')
      expect(result).toHaveProperty('users')
      expect(result).toHaveProperty('payments')
      expect(result).toHaveProperty('inventory')
      expect(result).toHaveProperty('shipments')
    })

    it('should return correct product counts', async () => {
      const result = await dashboardService.getStats()

      expect(result.products.total).toBe(248)
      expect(result.products.addedThisMonth).toBe(12)
    })

    it('should return correct order counts with trend', async () => {
      const result = await dashboardService.getStats()

      expect(result.orders.total).toBe(1284)
      expect(result.orders.thisMonth).toBe(100)
      // trend = ((100 - 80) / 80) * 100 = 25
      expect(result.orders.trend).toBe(25)
    })

    it('should return correct user count', async () => {
      const result = await dashboardService.getStats()

      expect(result.users.total).toBe(3429)
    })

    it('should return correct payment data with trend', async () => {
      const result = await dashboardService.getStats()

      expect(result.payments.totalAmountThisMonth).toBe(420000)
      expect(result.payments.currency).toBe('XAF')
      // trend = ((420000 - 390000) / 390000) * 100 ≈ 8
      expect(result.payments.trend).toBe(8)
    })

    it('should return correct inventory low stock count', async () => {
      const result = await dashboardService.getStats()

      expect(result.inventory.lowStockCount).toBe(14)
    })

    it('should return correct shipment count with trend', async () => {
      const result = await dashboardService.getStats()

      expect(result.shipments.inProgress).toBe(67)
      // trend = ((67 - 55) / 55) * 100 ≈ 22
      expect(result.shipments.trend).toBe(22)
    })
  })

  describe('getSalesChart', () => {
    it('should return 12 monthly data points for a given year', async () => {
      ;(mockPrisma.payment.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 100000 } })
      ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(50)

      const result = await dashboardService.getSalesChart({ year: '2026', period: 'monthly' })

      expect(result.year).toBe(2026)
      expect(result.period).toBe('monthly')
      expect(result.currency).toBe('XAF')
      expect(result.points).toHaveLength(12)
    })

    it('should include label, amount and orderCount for each point', async () => {
      ;(mockPrisma.payment.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 50000 } })
      ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(25)

      const result = await dashboardService.getSalesChart({ year: '2026' })

      result.points.forEach((point) => {
        expect(point).toHaveProperty('label')
        expect(point).toHaveProperty('amount')
        expect(point).toHaveProperty('orderCount')
        expect(point.amount).toBe(50000)
        expect(point.orderCount).toBe(25)
      })
    })

    it('should use current year if year not provided', async () => {
      ;(mockPrisma.payment.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 0 } })
      ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(0)

      const result = await dashboardService.getSalesChart({})

      expect(result.year).toBe(new Date().getFullYear())
    })

    it('should return 0 amount for months with no payments', async () => {
      ;(mockPrisma.payment.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null } })
      ;(mockPrisma.order.count as jest.Mock).mockResolvedValue(0)

      const result = await dashboardService.getSalesChart({ year: '2026' })

      result.points.forEach((point) => {
        expect(point.amount).toBe(0)
        expect(point.orderCount).toBe(0)
      })
    })
  })
})