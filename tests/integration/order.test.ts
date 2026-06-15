import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Order Integration', () => {
  const timestamp = Date.now()
  const userCredentials = {
    username: `order_user_${timestamp}`,
    email: `order_user_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Order',
    lastName: 'User',
    age: 25,
  }
  const adminCredentials = {
    username: `order_admin_${timestamp}`,
    email: `order_admin_${timestamp}@example.com`,
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    age: 30,
    role: 'admin',
  }

  const shippingAddress = {
    street: '123 Rue Principale',
    city: 'Yaoundé',
    country: 'CM',
    postalCode: '00000',
  }

  let userToken: string
  let adminToken: string
  let productId: number
  let orderId: string

  beforeAll(async () => {
    const userRes = await request(app).post('/signup').send(userCredentials)
    userToken = userRes.body.data.token

    const adminRes = await request(app).post('/signup').send(adminCredentials)
    adminToken = adminRes.body.data.token

    const productRes = await request(app)
      .post('/product')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Order Test Product',
        description: 'Product for order tests',
        price: 75.00,
        category: 'Test',
        stock: 50,
      })
    productId = productRes.body.data.id
  })

  afterAll(async () => {
    await prisma.orderItem.deleteMany({
      where: { product: { name: 'Order Test Product' } },
    })
    await prisma.order.deleteMany({
      where: { user: { username: userCredentials.username } },
    })
    await prisma.product.deleteMany({ where: { name: 'Order Test Product' } })
    await prisma.user.deleteMany({
      where: {
        username: { in: [userCredentials.username, adminCredentials.username] },
      },
    })
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('POST /orders', () => {
    it('should create an order', async () => {
      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ id: String(productId), quantity: 2 }],
          shippingAddress,
        })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.totalAmount).toBe(150)
      expect(res.body.data.status).toBe('PENDING')
      expect(res.body.data.items).toHaveLength(1)
      orderId = res.body.data.id
    })

    it('should return 404 if product not found', async () => {
      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ id: '999999', quantity: 1 }],
          shippingAddress,
        })

      expect(res.status).toBe(404)
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ items: [] }) // items must have at least 1

      expect(res.status).toBe(400)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/orders')
        .send({ items: [{ id: String(productId), quantity: 1 }], shippingAddress })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /orders', () => {
    it('should return paginated orders', async () => {
      const res = await request(app)
        .get('/orders')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data).toHaveProperty('total')
      expect(res.body.data).toHaveProperty('totalPages')
    })

    it('should filter orders by status', async () => {
      const res = await request(app)
        .get('/orders?status=PENDING')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      res.body.data.items.forEach((o: { status: string }) => {
        expect(o.status).toBe('PENDING')
      })
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get('/orders')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /orders/:orderId', () => {
    it('should return order by id', async () => {
      const res = await request(app)
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(orderId)
    })

    it('should return 404 if order not found', async () => {
      const res = await request(app)
        .get('/orders/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /orders/:orderId', () => {
    it('should update order notes', async () => {
      const res = await request(app)
        .put(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ notes: 'Please deliver in the morning' })

      expect(res.status).toBe(200)
      expect(res.body.data.notes).toBe('Please deliver in the morning')
    })

    it('should return 404 if order not found', async () => {
      const res = await request(app)
        .put('/orders/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ notes: 'test' })

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /orders/:orderId/status', () => {
    it('should update order status when admin', async () => {
      const res = await request(app)
        .put(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' })

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('CONFIRMED')
    })

    it('should return 400 with invalid status', async () => {
      const res = await request(app)
        .put(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID_STATUS' })

      expect(res.status).toBe(400)
    })

    it('should return 404 if order not found', async () => {
      const res = await request(app)
        .put('/orders/nonexistent-id/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /orders/:orderId', () => {
    it('should delete (cancel) order', async () => {
      const res = await request(app)
        .delete(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('message', 'Order cancelled successfully')
    })

    it('should return 404 if order not found', async () => {
      const res = await request(app)
        .delete('/orders/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).delete(`/orders/${orderId}`)
      expect(res.status).toBe(401)
    })
  })
})