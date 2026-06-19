// tests/integration/dashboard.test.ts
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Dashboard Integration', () => {
  const timestamp = Date.now()
  const adminCredentials = {
    username: `dash_admin_${timestamp}`,
    email: `dash_admin_${timestamp}@example.com`,
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    age: 30,
    role: 'admin',
  }
  const userCredentials = {
    username: `dash_user_${timestamp}`,
    email: `dash_user_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Regular',
    lastName: 'User',
    age: 25,
  }

  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    const adminRes = await request(app).post('/signup').send(adminCredentials)
    adminToken = adminRes.body.data.token

    const userRes = await request(app).post('/signup').send(userCredentials)
    userToken = userRes.body.data.token
  })

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        username: { in: [adminCredentials.username, userCredentials.username] },
      },
    })
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('GET /dashboard/stats', () => {
    it('should return stats when admin', async () => {
      const res = await request(app)
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)

      const data = res.body.data
      expect(data).toHaveProperty('products')
      expect(data).toHaveProperty('orders')
      expect(data).toHaveProperty('users')
      expect(data).toHaveProperty('payments')
      expect(data).toHaveProperty('inventory')
      expect(data).toHaveProperty('shipments')
    })

    it('should return correct structure for products stat', async () => {
      const res = await request(app)
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.body.data.products).toHaveProperty('total')
      expect(res.body.data.products).toHaveProperty('addedThisMonth')
      expect(typeof res.body.data.products.total).toBe('number')
    })

    it('should return correct structure for orders stat', async () => {
      const res = await request(app)
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.body.data.orders).toHaveProperty('total')
      expect(res.body.data.orders).toHaveProperty('thisMonth')
      expect(res.body.data.orders).toHaveProperty('trend')
    })

    it('should return correct structure for payments stat', async () => {
      const res = await request(app)
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.body.data.payments).toHaveProperty('totalAmountThisMonth')
      expect(res.body.data.payments).toHaveProperty('currency', 'XAF')
      expect(res.body.data.payments).toHaveProperty('trend')
    })

    it('should return correct structure for inventory stat', async () => {
      const res = await request(app)
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.body.data.inventory).toHaveProperty('lowStockCount')
      expect(typeof res.body.data.inventory.lowStockCount).toBe('number')
    })

    it('should return correct structure for shipments stat', async () => {
      const res = await request(app)
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.body.data.shipments).toHaveProperty('inProgress')
      expect(res.body.data.shipments).toHaveProperty('trend')
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get('/dashboard/stats')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /dashboard/sales-chart', () => {
    it('should return sales chart data when admin', async () => {
      const res = await request(app)
        .get('/dashboard/sales-chart')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)

      const data = res.body.data
      expect(data).toHaveProperty('period')
      expect(data).toHaveProperty('year')
      expect(data).toHaveProperty('points')
      expect(data).toHaveProperty('currency', 'XAF')
      expect(Array.isArray(data.points)).toBe(true)
      expect(data.points).toHaveLength(12)
    })

    it('should return 12 monthly points by default', async () => {
      const res = await request(app)
        .get('/dashboard/sales-chart')
        .set('Authorization', `Bearer ${adminToken}`)

      res.body.data.points.forEach((point: { label: string; amount: number; orderCount: number }) => {
        expect(point).toHaveProperty('label')
        expect(point).toHaveProperty('amount')
        expect(point).toHaveProperty('orderCount')
        expect(typeof point.amount).toBe('number')
        expect(typeof point.orderCount).toBe('number')
      })
    })

    it('should accept year and period query params', async () => {
      const res = await request(app)
        .get('/dashboard/sales-chart?year=2025&period=monthly')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.year).toBe(2025)
      expect(res.body.data.period).toBe('monthly')
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .get('/dashboard/sales-chart')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get('/dashboard/sales-chart')
      expect(res.status).toBe(401)
    })
  })
})