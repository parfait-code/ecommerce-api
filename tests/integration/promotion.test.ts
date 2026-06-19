// tests/integration/promotion.test.ts
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Promotion Integration', () => {
  const timestamp = Date.now()
  const adminCredentials = {
    username: `promo_admin_${timestamp}`,
    email: `promo_admin_${timestamp}@example.com`,
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    age: 30,
    role: 'admin',
  }
  const userCredentials = {
    username: `promo_user_${timestamp}`,
    email: `promo_user_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Regular',
    lastName: 'User',
    age: 25,
  }

  const now = new Date()
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const basePromotion = {
    name: `Test Promo ${timestamp}`,
    slug: `test-promo-${timestamp}`,
    description: 'A test promotion',
    startDate: now.toISOString(),
    endDate: future.toISOString(),
    isActive: true,
  }

  let adminToken: string
  let userToken: string
  let promotionId: string
  let categoryId: string
  let productId: number
  let discountId: string
  let couponId: string

  beforeAll(async () => {
    const adminRes = await request(app).post('/signup').send(adminCredentials)
    adminToken = adminRes.body.data.token

    const userRes = await request(app).post('/signup').send(userCredentials)
    userToken = userRes.body.data.token

    const catRes = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Promo Category ${timestamp}`, slug: `promo-category-${timestamp}` })
    categoryId = catRes.body.data.id

    const productRes = await request(app)
      .post('/product')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Promo Test Product', price: 100, categoryId, stock: 50 })
    productId = productRes.body.data.id
  })

  afterAll(async () => {
    await prisma.couponUse.deleteMany({ where: { coupon: { promotionId } } })
    await prisma.couponCode.deleteMany({ where: { promotionId } })
    await prisma.discountProduct.deleteMany({ where: { discount: { promotionId } } })
    await prisma.discount.deleteMany({ where: { promotionId } })
    await prisma.promotion.deleteMany({ where: { id: promotionId } })
    await prisma.promotion.deleteMany({ where: { slug: { startsWith: 'test-promo-' } } })
    await prisma.product.deleteMany({ where: { name: 'Promo Test Product' } })
    await prisma.category.deleteMany({ where: { id: categoryId } })
    await prisma.user.deleteMany({
      where: {
        username: { in: [adminCredentials.username, userCredentials.username] },
      },
    })
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('POST /promotions', () => {
    it('should create a promotion when admin', async () => {
      const res = await request(app)
        .post('/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(basePromotion)

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.name).toBe(basePromotion.name)
      expect(res.body.data.slug).toBe(basePromotion.slug)
      expect(res.body.data.isActive).toBe(true)
      promotionId = res.body.data.id
    })

    it('should return 409 if slug already taken', async () => {
      const res = await request(app)
        .post('/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(basePromotion)

      expect(res.status).toBe(409)
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post('/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'x' }) // too short, missing required fields

      expect(res.status).toBe(400)
    })

    it('should return 400 if endDate is before startDate', async () => {
      const res = await request(app)
        .post('/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Bad Dates ${timestamp}`,
          slug: `bad-dates-${timestamp}`,
          startDate: future.toISOString(),
          endDate: now.toISOString(),
          isActive: true,
        })

      expect(res.status).toBe(400)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .post('/promotions')
        .set('Authorization', `Bearer ${userToken}`)
        .send(basePromotion)

      expect(res.status).toBe(403)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).post('/promotions').send(basePromotion)
      expect(res.status).toBe(401)
    })
  })

  describe('GET /promotions', () => {
    it('should return all promotions when admin', async () => {
      const res = await request(app)
        .get('/promotions')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .get('/promotions')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get('/promotions')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /promotions/:promotionId', () => {
    it('should return promotion by id when admin', async () => {
      const res = await request(app)
        .get(`/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(promotionId)
    })

    it('should return 404 if not found', async () => {
      const res = await request(app)
        .get('/promotions/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /promotions/slug/:slug', () => {
    it('should return promotion by slug (no auth required)', async () => {
      const res = await request(app).get(`/promotions/slug/${basePromotion.slug}`)

      expect(res.status).toBe(200)
      expect(res.body.data.slug).toBe(basePromotion.slug)
    })

    it('should return 404 if slug not found', async () => {
      const res = await request(app).get('/promotions/slug/nonexistent-slug')
      expect(res.status).toBe(404)
    })
  })

  describe('PUT /promotions/:promotionId', () => {
    it('should update a promotion when admin', async () => {
      const res = await request(app)
        .put(`/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated description' })

      expect(res.status).toBe(200)
      expect(res.body.data.description).toBe('Updated description')
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .put(`/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ description: 'Hacked' })

      expect(res.status).toBe(403)
    })

    it('should return 404 if not found', async () => {
      const res = await request(app)
        .put('/promotions/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'x' })

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /promotions/:promotionId/toggle', () => {
    it('should toggle promotion isActive when admin', async () => {
      const resBefore = await request(app)
        .get(`/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      const wasActive = resBefore.body.data.isActive

      const res = await request(app)
        .patch(`/promotions/${promotionId}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.isActive).toBe(!wasActive)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .patch(`/promotions/${promotionId}/toggle`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })
  })

  describe('POST /promotions/:promotionId/discounts', () => {
    it('should create a discount targeting a category', async () => {
      const res = await request(app)
        .post(`/promotions/${promotionId}/discounts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'PERCENTAGE', value: 15, categoryId })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data.type).toBe('PERCENTAGE')
      expect(res.body.data.value).toBe(15)
      expect(res.body.data.category.id).toBe(categoryId)
      discountId = res.body.data.id
    })

    it('should create a discount targeting products', async () => {
      const res = await request(app)
        .post(`/promotions/${promotionId}/discounts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'FIXED_AMOUNT', value: 500, productIds: [productId] })

      expect(res.status).toBe(201)
      expect(res.body.data.products).toHaveLength(1)
      expect(res.body.data.products[0].product.id).toBe(productId)

      // Clean up the second discount
      await prisma.discountProduct.deleteMany({ where: { discountId: res.body.data.id } })
      await prisma.discount.deleteMany({ where: { id: res.body.data.id } })
    })

    it('should return 400 if percentage exceeds 100', async () => {
      const res = await request(app)
        .post(`/promotions/${promotionId}/discounts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'PERCENTAGE', value: 150, categoryId })

      expect(res.status).toBe(400)
    })

    it('should return 404 if promotion not found', async () => {
      const res = await request(app)
        .post('/promotions/nonexistent-id/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'PERCENTAGE', value: 10, categoryId })

      expect(res.status).toBe(404)
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post(`/promotions/${promotionId}/discounts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'PERCENTAGE', value: 10 }) // no categoryId or productIds

      expect(res.status).toBe(400)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .post(`/promotions/${promotionId}/discounts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'PERCENTAGE', value: 10, categoryId })

      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /promotions/:promotionId/discounts/:discountId', () => {
    it('should delete a discount when admin', async () => {
      const res = await request(app)
        .delete(`/promotions/${promotionId}/discounts/${discountId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('message', 'Discount deleted successfully')
    })

    it('should return 404 if discount not found', async () => {
      const res = await request(app)
        .delete(`/promotions/${promotionId}/discounts/nonexistent-id`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .delete(`/promotions/${promotionId}/discounts/${discountId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })
  })

  describe('POST /promotions/:promotionId/coupons', () => {
    it('should create a coupon when admin', async () => {
      const res = await request(app)
        .post(`/promotions/${promotionId}/coupons`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `PROMO${timestamp}`,
          maxUses: 50,
          perUserLimit: 1,
          isActive: true,
        })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data.code).toBe(`PROMO${timestamp}`)
      expect(res.body.data.maxUses).toBe(50)
      couponId = res.body.data.id
    })

    it('should return 404 if promotion not found', async () => {
      const res = await request(app)
        .post('/promotions/nonexistent-id/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'TEST', perUserLimit: 1, isActive: true })

      expect(res.status).toBe(404)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .post(`/promotions/${promotionId}/coupons`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ code: 'HACKED', perUserLimit: 1, isActive: true })

      expect(res.status).toBe(403)
    })
  })

  describe('POST /coupons/validate', () => {
    // First make sure the promotion is active
    beforeAll(async () => {
      const promoRes = await request(app)
        .get(`/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      if (!promoRes.body.data.isActive) {
        await request(app)
          .patch(`/promotions/${promotionId}/toggle`)
          .set('Authorization', `Bearer ${adminToken}`)
      }
    })

    it('should validate a valid coupon', async () => {
      const basketRes = await request(app)
        .post('/basket')
        .set('Authorization', `Bearer ${userToken}`)
      const basketId = basketRes.body.data.id

      const res = await request(app)
        .post('/coupons/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ code: `PROMO${timestamp}`, basketId })

      expect(res.status).toBe(200)
      expect(res.body.data.valid).toBe(true)
      expect(res.body.data.code).toBe(`PROMO${timestamp}`)

      await prisma.basket.deleteMany({ where: { id: basketId } })
    })

    it('should return 404 for invalid coupon code', async () => {
      const basketRes = await request(app)
        .post('/basket')
        .set('Authorization', `Bearer ${userToken}`)
      const basketId = basketRes.body.data.id

      const res = await request(app)
        .post('/coupons/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ code: 'INVALID_CODE', basketId })

      expect(res.status).toBe(404)

      await prisma.basket.deleteMany({ where: { id: basketId } })
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/coupons/validate')
        .send({ code: `PROMO${timestamp}`, basketId: 'basket-1' })

      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /promotions/:promotionId/coupons/:couponId', () => {
    it('should delete a coupon when admin', async () => {
      const res = await request(app)
        .delete(`/promotions/${promotionId}/coupons/${couponId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('message', 'Coupon deleted successfully')
    })

    it('should return 404 if coupon not found', async () => {
      const res = await request(app)
        .delete(`/promotions/${promotionId}/coupons/nonexistent-id`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .delete(`/promotions/${promotionId}/coupons/${couponId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /promotions/:promotionId', () => {
    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .delete(`/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 404 if not found', async () => {
      const res = await request(app)
        .delete('/promotions/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).delete(`/promotions/${promotionId}`)
      expect(res.status).toBe(401)
    })

    it('should delete promotion when admin', async () => {
      const res = await request(app)
        .delete(`/promotions/${promotionId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('message', 'Promotion deleted successfully')
    })
  })
})