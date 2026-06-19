// tests/integration/inventory.test.ts
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Inventory Integration', () => {
  const timestamp = Date.now()
  const adminCredentials = {
    username: `inventory_admin_${timestamp}`,
    email: `inventory_admin_${timestamp}@example.com`,
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    age: 30,
    role: 'admin',
  }
  const userCredentials = {
    username: `inventory_user_${timestamp}`,
    email: `inventory_user_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Regular',
    lastName: 'User',
    age: 25,
  }

  let adminToken: string
  let userToken: string
  let productId: number
  let categoryId: string
  let warehouseId: string
  let warehouseId2: string
  let inventoryId: string

  beforeAll(async () => {
    const adminRes = await request(app).post('/signup').send(adminCredentials)
    adminToken = adminRes.body.data.token

    const userRes = await request(app).post('/signup').send(userCredentials)
    userToken = userRes.body.data.token

    const catRes = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Inventory Electronics ${timestamp}`, slug: `inventory-electronics-${timestamp}` })
    categoryId = catRes.body.data.id

    const productRes = await request(app)
      .post('/product')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Inventory Test Product',
        description: 'Product for inventory tests',
        price: 30.00,
        categoryId,
        stock: 100,
      })
    productId = productRes.body.data.id

    const warehouseRes = await request(app)
      .post('/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Inventory Test Warehouse', location: 'Yaoundé, CM', capacity: 500 })
    warehouseId = warehouseRes.body.data.id

    const warehouseRes2 = await request(app)
      .post('/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Inventory Test Warehouse 2', location: 'Douala, CM', capacity: 300 })
    warehouseId2 = warehouseRes2.body.data.id
  })

  afterAll(async () => {
    await prisma.inventory.deleteMany({ where: { productId } })
    await prisma.product.deleteMany({ where: { name: 'Inventory Test Product' } })
    await prisma.warehouse.deleteMany({
      where: { name: { startsWith: 'Inventory Test Warehouse' } },
    })
    await prisma.category.deleteMany({ where: { id: categoryId } })
    await prisma.user.deleteMany({
      where: {
        username: { in: [adminCredentials.username, userCredentials.username] },
      },
    })
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('POST /inventory', () => {
    it('should create an inventory item when admin', async () => {
      const res = await request(app)
        .post('/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ product_id: productId, warehouse_id: warehouseId, quantity: 50 })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.quantity).toBe(50)
      expect(res.body.data.product.id).toBe(productId)
      expect(res.body.data.warehouse.id).toBe(warehouseId)
      inventoryId = res.body.data.id
    })

    it('should return 409 if inventory already exists for product+warehouse', async () => {
      const res = await request(app)
        .post('/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ product_id: productId, warehouse_id: warehouseId, quantity: 10 })

      expect(res.status).toBe(409)
    })

    it('should return 404 if product not found', async () => {
      const res = await request(app)
        .post('/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ product_id: 999999, warehouse_id: warehouseId, quantity: 10 })

      expect(res.status).toBe(404)
    })

    it('should return 404 if warehouse not found', async () => {
      const res = await request(app)
        .post('/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ product_id: productId, warehouse_id: 'nonexistent', quantity: 10 })

      expect(res.status).toBe(404)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .post('/inventory')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ product_id: productId, warehouse_id: warehouseId, quantity: 10 })

      expect(res.status).toBe(403)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/inventory')
        .send({ product_id: productId, warehouse_id: warehouseId, quantity: 10 })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /inventory', () => {
    it('should return paginated inventory when authenticated', async () => {
      const res = await request(app)
        .get('/inventory')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data).toHaveProperty('total')
      expect(res.body.data).toHaveProperty('page')
      expect(res.body.data).toHaveProperty('limit')
      expect(res.body.data).toHaveProperty('totalPages')
      expect(Array.isArray(res.body.data.items)).toBe(true)
    })

    it('should filter by category', async () => {
      const res = await request(app)
        .get(`/inventory?category=Inventory Electronics ${timestamp}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('items')
      res.body.data.items.forEach((item: { product: { categoryId: string } }) => {
        expect(item.product.categoryId).toBe(categoryId)
      })
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get('/inventory')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /inventory/:item_id', () => {
    it('should return inventory item by id', async () => {
      const res = await request(app)
        .get(`/inventory/${inventoryId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(inventoryId)
    })

    it('should return 404 if not found', async () => {
      const res = await request(app)
        .get('/inventory/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /inventory/low-stock', () => {
    it('should return items below default threshold (10)', async () => {
      const catRes = await request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Low Stock Cat ${timestamp}`, slug: `low-stock-cat-${timestamp}` })
      const lowCatId = catRes.body.data.id

      const lowStockProduct = await request(app)
        .post('/product')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Low Stock Product', price: 10, categoryId: lowCatId, stock: 5 })

      await request(app)
        .post('/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ product_id: lowStockProduct.body.data.id, warehouse_id: warehouseId, quantity: 3 })

      const res = await request(app)
        .get('/inventory/low-stock')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      res.body.data.forEach((item: { quantity: number }) => {
        expect(item.quantity).toBeLessThanOrEqual(10)
        expect(item.quantity).toBeGreaterThan(0)
      })

      await prisma.inventory.deleteMany({ where: { productId: lowStockProduct.body.data.id } })
      await prisma.product.deleteMany({ where: { id: lowStockProduct.body.data.id } })
      await prisma.category.deleteMany({ where: { id: lowCatId } })
    })
  })

  describe('GET /inventory/out-of-stock', () => {
    it('should return out of stock items', async () => {
      const res = await request(app)
        .get('/inventory/out-of-stock')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      res.body.data.forEach((item: { quantity: number }) => {
        expect(item.quantity).toBe(0)
      })
    })
  })

  describe('GET /inventory/search', () => {
    it('should return items matching keyword', async () => {
      const res = await request(app)
        .get('/inventory/search?keyword=Inventory Test')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('should return 500 if keyword is missing', async () => {
      const res = await request(app)
        .get('/inventory/search')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(500)
    })
  })

  describe('PUT /inventory/:item_id', () => {
    it('should update inventory quantity when admin', async () => {
      const res = await request(app)
        .put(`/inventory/${inventoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 80 })

      expect(res.status).toBe(200)
      expect(res.body.data.quantity).toBe(80)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .put(`/inventory/${inventoryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: 10 })

      expect(res.status).toBe(403)
    })

    it('should return 404 if not found', async () => {
      const res = await request(app)
        .put('/inventory/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 10 })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /inventory/transfer', () => {
    it('should transfer stock between warehouses', async () => {
      const res = await request(app)
        .post('/inventory/transfer')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_id: inventoryId,
          from_warehouse: warehouseId,
          to_warehouse: warehouseId2,
          quantity: 20,
        })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data.quantity).toBe(20)
      expect(res.body.data.from_warehouse).toBe(warehouseId)
      expect(res.body.data.to_warehouse).toBe(warehouseId2)
    })

    it('should return 400 if insufficient stock', async () => {
      const res = await request(app)
        .post('/inventory/transfer')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_id: inventoryId,
          from_warehouse: warehouseId,
          to_warehouse: warehouseId2,
          quantity: 99999,
        })

      expect(res.status).toBe(400)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .post('/inventory/transfer')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          item_id: inventoryId,
          from_warehouse: warehouseId,
          to_warehouse: warehouseId2,
          quantity: 5,
        })

      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /inventory/:item_id', () => {
    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .delete(`/inventory/${inventoryId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 404 if not found', async () => {
      const res = await request(app)
        .delete('/inventory/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })

    it('should delete inventory item when admin', async () => {
      const res = await request(app)
        .delete(`/inventory/${inventoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('message', 'Inventory item deleted successfully')
    })
  })
})