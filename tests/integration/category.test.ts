// tests/integration/category.test.ts
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Category Integration', () => {
  const timestamp = Date.now()
  const adminCredentials = {
    username: `cat_admin_${timestamp}`,
    email: `cat_admin_${timestamp}@example.com`,
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    age: 30,
    role: 'admin',
  }
  const userCredentials = {
    username: `cat_user_${timestamp}`,
    email: `cat_user_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Regular',
    lastName: 'User',
    age: 25,
  }

  let adminToken: string
  let userToken: string
  let categoryId: string
  let childCategoryId: string

  const baseCategory = {
    name: `Test Electronics ${timestamp}`,
    slug: `test-electronics-${timestamp}`,
    description: 'Electronic devices',
  }

  beforeAll(async () => {
    const adminRes = await request(app).post('/signup').send(adminCredentials)
    adminToken = adminRes.body.data.token

    const userRes = await request(app).post('/signup').send(userCredentials)
    userToken = userRes.body.data.token
  })

  afterAll(async () => {
    await prisma.category.deleteMany({
      where: { slug: { startsWith: `test-electronics-${timestamp}` } },
    })
    await prisma.category.deleteMany({
      where: { slug: { startsWith: `test-subcategory-${timestamp}` } },
    })
    await prisma.user.deleteMany({
      where: {
        username: { in: [adminCredentials.username, userCredentials.username] },
      },
    })
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('POST /categories', () => {
    it('should create a category when admin', async () => {
      const res = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(baseCategory)

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.name).toBe(baseCategory.name)
      expect(res.body.data.slug).toBe(baseCategory.slug)
      expect(res.body.data).toHaveProperty('_count')
      categoryId = res.body.data.id
    })

    it('should create a child category with parentId', async () => {
      const res = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Test Subcategory ${timestamp}`,
          slug: `test-subcategory-${timestamp}`,
          parentId: categoryId,
        })

      expect(res.status).toBe(201)
      expect(res.body.data.parent.id).toBe(categoryId)
      childCategoryId = res.body.data.id
    })

    it('should return 409 if name already taken', async () => {
      const res = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(baseCategory)

      expect(res.status).toBe(409)
    })

    it('should return 409 if slug already taken', async () => {
      const res = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Different Name ${timestamp}`, slug: baseCategory.slug })

      expect(res.status).toBe(409)
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'x' }) // too short, missing slug

      expect(res.status).toBe(400)
    })

    it('should return 400 with invalid slug format', async () => {
      const res = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Valid Name', slug: 'Invalid Slug With Spaces' })

      expect(res.status).toBe(400)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Hacked', slug: 'hacked' })

      expect(res.status).toBe(403)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/categories')
        .send(baseCategory)

      expect(res.status).toBe(401)
    })
  })

  describe('GET /categories', () => {
    it('should return all categories when authenticated', async () => {
      const res = await request(app)
        .get('/categories')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get('/categories')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /categories/:categoryId', () => {
    it('should return category by id', async () => {
      const res = await request(app)
        .get(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(categoryId)
      expect(res.body.data).toHaveProperty('children')
      expect(res.body.data).toHaveProperty('_count')
    })

    it('should return 404 if not found', async () => {
      const res = await request(app)
        .get('/categories/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get(`/categories/${categoryId}`)
      expect(res.status).toBe(401)
    })
  })

  describe('GET /categories/slug/:slug', () => {
    it('should return category by slug (no auth required)', async () => {
      const res = await request(app).get(`/categories/slug/${baseCategory.slug}`)

      expect(res.status).toBe(200)
      expect(res.body.data.slug).toBe(baseCategory.slug)
    })

    it('should return 404 if slug not found', async () => {
      const res = await request(app).get('/categories/slug/nonexistent-slug')
      expect(res.status).toBe(404)
    })
  })

  describe('GET /categories/slug/:slug/products', () => {
    it('should return products for a category slug (no auth required)', async () => {
      const res = await request(app).get(`/categories/slug/${baseCategory.slug}/products`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data).toHaveProperty('total')
      expect(res.body.data).toHaveProperty('category')
      expect(res.body.data.category.slug).toBe(baseCategory.slug)
    })

    it('should return 404 for unknown slug', async () => {
      const res = await request(app).get('/categories/slug/unknown-slug/products')
      expect(res.status).toBe(404)
    })
  })

  describe('PUT /categories/:categoryId', () => {
    it('should update a category when admin', async () => {
      const res = await request(app)
        .put(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated description' })

      expect(res.status).toBe(200)
      expect(res.body.data.description).toBe('Updated description')
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .put(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ description: 'Hacked' })

      expect(res.status).toBe(403)
    })

    it('should return 404 if category not found', async () => {
      const res = await request(app)
        .put('/categories/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'x' })

      expect(res.status).toBe(404)
    })

    it('should return 400 if category tries to set itself as parent', async () => {
      const res = await request(app)
        .put(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ parentId: categoryId })

      expect(res.status).toBe(400)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put(`/categories/${categoryId}`)
        .send({ description: 'x' })

      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /categories/:categoryId', () => {
    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .delete(`/categories/${childCategoryId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 404 if category not found', async () => {
      const res = await request(app)
        .delete('/categories/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).delete(`/categories/${childCategoryId}`)
      expect(res.status).toBe(401)
    })

    it('should delete child category when admin', async () => {
      const res = await request(app)
        .delete(`/categories/${childCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('message', 'Category deleted successfully')
    })

    it('should return 400 if category has products attached', async () => {
      // Create a product linked to the category, then try to delete category
      const productRes = await request(app)
        .post('/product')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Category Product', price: 10, categoryId, stock: 1 })
      const productId = productRes.body.data.id

      const res = await request(app)
        .delete(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(400)

      await prisma.product.deleteMany({ where: { id: productId } })
    })

    it('should delete parent category when no products attached', async () => {
      const res = await request(app)
        .delete(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('message', 'Category deleted successfully')
    })
  })
})