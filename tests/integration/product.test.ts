import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Product Integration', () => {
  let adminToken: string
  let productId: number
  const timestamp = Date.now()

  beforeAll(async () => {
    const res = await request(app).post('/signup').send({
      username: `admin_${timestamp}`,
      email: `admin_${timestamp}@example.com`,
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      age: 30,
      role: 'admin',
    })
    adminToken = res.body.data.token
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('POST /product', () => {
    it('should create a product', async () => {
      const res = await request(app)
        .post('/product')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          description: 'A test product',
          price: 99.99,
          category: 'Electronics',
          stock: 10,
        })
      expect(res.status).toBe(201)
      expect(res.body.data).toHaveProperty('id')
      productId = res.body.data.id
    })

    it('should return 401 without token', async () => {
      const res = await request(app).post('/product').send({ name: 'x' })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /product', () => {
    it('should return paginated products', async () => {
      const res = await request(app).get('/product')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data).toHaveProperty('total')
    })
  })

  describe('GET /product/:productId', () => {
    it('should return product by id', async () => {
      const res = await request(app).get(`/product/${productId}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(productId)
    })

    it('should return 404 if not found', async () => {
      const res = await request(app).get('/product/999999')
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /product/:productId', () => {
    it('should update product', async () => {
      const res = await request(app)
        .patch(`/product/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 149.99 })
      expect(res.status).toBe(200)
      expect(res.body.data.price).toBe(149.99)
    })
  })

  describe('DELETE /product/:productId', () => {
    it('should delete product', async () => {
      const res = await request(app)
        .delete(`/product/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('numberOfProductsDeleted', 1)
    })
  })
})