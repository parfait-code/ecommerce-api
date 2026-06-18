import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Product Integration', () => {
  let adminToken: string
  let productId: number
  let categoryId: string
  const timestamp = Date.now()
  const adminUsername = `admin_${timestamp}`

  beforeAll(async () => {
    const res = await request(app).post('/signup').send({
      username: adminUsername,
      email: `admin_${timestamp}@example.com`,
      password: 'admin123',
      firstName: 'Admin', lastName: 'User', age: 30, role: 'admin',
    })
    adminToken = res.body.data.token

    const catRes = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Electronics', slug: `test-electronics-${timestamp}` })
    categoryId = catRes.body.data.id
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { name: { startsWith: 'Test Product' } } })
    await prisma.category.deleteMany({ where: { slug: { startsWith: 'test-electronics' } } })
    await prisma.user.deleteMany({ where: { username: adminUsername } })
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('POST /product', () => {
    it('should create a product with categoryId', async () => {
      const res = await request(app)
        .post('/product')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product', description: 'A test product',
          price: 99.99, categoryId, stock: 10,
        })
      expect(res.status).toBe(201)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data).toHaveProperty('category')
      expect(res.body.data.category.id).toBe(categoryId)
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

    it('should filter by categoryId', async () => {
      const res = await request(app).get(`/product?categoryId=${categoryId}`)
      expect(res.status).toBe(200)
      res.body.data.items.forEach((p: { category: { id: string } }) => {
        expect(p.category.id).toBe(categoryId)
      })
    })
  })

  describe('GET /product/:productId', () => {
    it('should return product with category', async () => {
      const res = await request(app).get(`/product/${productId}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(productId)
      expect(res.body.data).toHaveProperty('category')
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