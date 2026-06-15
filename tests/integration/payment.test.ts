import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Payment Integration', () => {
  const timestamp = Date.now()
  const userCredentials = {
    username: `payment_user_${timestamp}`,
    email: `payment_user_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Payment',
    lastName: 'User',
    age: 25,
  }
  const otherUserCredentials = {
    username: `payment_other_${timestamp}`,
    email: `payment_other_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Other',
    lastName: 'User',
    age: 25,
  }
  const adminCredentials = {
    username: `payment_admin_${timestamp}`,
    email: `payment_admin_${timestamp}@example.com`,
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
  let otherUserToken: string
  let adminToken: string
  let productId: number
  let orderId: string
  let paymentId: string

  beforeAll(async () => {
    const userRes = await request(app).post('/signup').send(userCredentials)
    userToken = userRes.body.data.token

    const otherRes = await request(app).post('/signup').send(otherUserCredentials)
    otherUserToken = otherRes.body.data.token

    const adminRes = await request(app).post('/signup').send(adminCredentials)
    adminToken = adminRes.body.data.token

    // Create a product
    const productRes = await request(app)
      .post('/product')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Payment Test Product',
        description: 'Product for payment tests',
        price: 80.00,
        category: 'Test',
        stock: 50,
      })
    productId = productRes.body.data.id

    // Create an order to pay for
    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [{ id: String(productId), quantity: 1 }],
        shippingAddress,
      })
    orderId = orderRes.body.data.id
  })

  afterAll(async () => {
    await prisma.payment.deleteMany({
      where: { order: { user: { username: userCredentials.username } } },
    })
    await prisma.orderItem.deleteMany({
      where: { product: { name: 'Payment Test Product' } },
    })
    await prisma.order.deleteMany({
      where: { user: { username: userCredentials.username } },
    })
    await prisma.product.deleteMany({ where: { name: 'Payment Test Product' } })
    await prisma.user.deleteMany({
      where: {
        username: {
          in: [
            userCredentials.username,
            otherUserCredentials.username,
            adminCredentials.username,
          ],
        },
      },
    })
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('GET /payment-methods', () => {
    it('should return available payment methods without auth', async () => {
      const res = await request(app).get('/payment-methods')

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data).toHaveLength(4)
    })

    it('should include CASH_ON_DELIVERY as available', () => {
      // Vérifié via le test précédent, on teste ici le contenu
      return request(app)
        .get('/payment-methods')
        .then((res) => {
          const cod = res.body.data.find((m: { id: string }) => m.id === 'CASH_ON_DELIVERY')
          expect(cod).toBeDefined()
          expect(cod.available).toBe(true)
        })
    })

    it('should mark STRIPE, PAYPAL, CINETPAY as unavailable', async () => {
      const res = await request(app).get('/payment-methods')
      const unavailable = res.body.data.filter((m: { available: boolean }) => !m.available)
      expect(unavailable).toHaveLength(3)
      expect(unavailable.map((m: { id: string }) => m.id)).toEqual(
        expect.arrayContaining(['STRIPE', 'PAYPAL', 'CINETPAY']),
      )
    })
  })

  describe('POST /payments', () => {
    it('should create a payment with CASH_ON_DELIVERY', async () => {
      const res = await request(app)
        .post('/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ order_id: orderId, method: 'CASH_ON_DELIVERY', currency: 'XAF' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.method).toBe('CASH_ON_DELIVERY')
      expect(res.body.data.amount).toBe(80)
      expect(res.body.data.currency).toBe('XAF')
      paymentId = res.body.data.id
    })

    it('should return 503 if payment method is unavailable', async () => {
      // Create a second order to avoid reuse
      const orderRes = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ id: String(productId), quantity: 1 }],
          shippingAddress,
        })

      const res = await request(app)
        .post('/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ order_id: orderRes.body.data.id, method: 'STRIPE', currency: 'XAF' })

      expect(res.status).toBe(503)
      expect(res.body.status).toBe(false)

      await prisma.orderItem.deleteMany({ where: { orderId: orderRes.body.data.id } })
      await prisma.order.deleteMany({ where: { id: orderRes.body.data.id } })
    })

    it('should return 403 if user does not own the order', async () => {
      const orderRes = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ id: String(productId), quantity: 1 }],
          shippingAddress,
        })

      const res = await request(app)
        .post('/payments')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ order_id: orderRes.body.data.id, method: 'CASH_ON_DELIVERY', currency: 'XAF' })

      expect(res.status).toBe(403)

      await prisma.orderItem.deleteMany({ where: { orderId: orderRes.body.data.id } })
      await prisma.order.deleteMany({ where: { id: orderRes.body.data.id } })
    })

    it('should return 404 if order not found', async () => {
      const res = await request(app)
        .post('/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ order_id: 'nonexistent-order', method: 'CASH_ON_DELIVERY', currency: 'XAF' })

      expect(res.status).toBe(404)
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post('/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ order_id: orderId, method: 'INVALID_METHOD' })

      expect(res.status).toBe(400)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/payments')
        .send({ order_id: orderId, method: 'CASH_ON_DELIVERY', currency: 'XAF' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /payments/:payment_id', () => {
    it('should return payment by id', async () => {
      const res = await request(app)
        .get(`/payments/${paymentId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data.id).toBe(paymentId)
    })

    it('should return 404 if payment not found', async () => {
      const res = await request(app)
        .get('/payments/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get(`/payments/${paymentId}`)
      expect(res.status).toBe(401)
    })
  })

  describe('GET /orders/:orderId/payments', () => {
    it('should return all payments for an order', async () => {
      const res = await request(app)
        .get(`/orders/${orderId}/payments`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThan(0)
      expect(res.body.data[0].orderId).toBe(orderId)
    })

    it('should return empty array if no payments for order', async () => {
      const orderRes = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ id: String(productId), quantity: 1 }],
          shippingAddress,
        })
      const newOrderId = orderRes.body.data.id

      const res = await request(app)
        .get(`/orders/${newOrderId}/payments`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(0)

      await prisma.orderItem.deleteMany({ where: { orderId: newOrderId } })
      await prisma.order.deleteMany({ where: { id: newOrderId } })
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get(`/orders/${orderId}/payments`)
      expect(res.status).toBe(401)
    })
  })
})