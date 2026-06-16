import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Warehouse Integration', () => {
  const timestamp = Date.now()
  const adminCredentials = {
    username: `warehouse_admin_${timestamp}`,
    email: `warehouse_admin_${timestamp}@example.com`,
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    age: 30,
    role: 'admin',
  }
  const userCredentials = {
    username: `warehouse_user_${timestamp}`,
    email: `warehouse_user_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Regular',
    lastName: 'User',
    age: 25,
  }

  let adminToken: string
  let userToken: string
  let warehouseId: string

  beforeAll(async () => {
    const adminRes = await request(app).post('/signup').send(adminCredentials)
    adminToken = adminRes.body.data.token

    const userRes = await request(app).post('/signup').send(userCredentials)
    userToken = userRes.body.data.token
  })

  afterAll(async () => {
    await prisma.warehouse.deleteMany({
      where: { name: { startsWith: 'Test Warehouse' } },
    })
    await prisma.user.deleteMany({
      where: {
        username: { in: [adminCredentials.username, userCredentials.username] },
      },
    })
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('POST /warehouses', () => {
    it('should create a warehouse when admin', async () => {
      const res = await request(app)
        .post('/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Warehouse', location: 'Yaoundé, CM', capacity: 500 })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.name).toBe('Test Warehouse')
      expect(res.body.data.location).toBe('Yaoundé, CM')
      expect(res.body.data.capacity).toBe(500)
      warehouseId = res.body.data.id
    })

    it('should create a warehouse without optional capacity', async () => {
      const res = await request(app)
        .post('/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Warehouse No Capacity', location: 'Douala, CM' })

      expect(res.status).toBe(201)
      expect(res.body.data.capacity).toBeNull()

      await prisma.warehouse.deleteMany({ where: { id: res.body.data.id } })
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .post('/warehouses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Test Warehouse', location: 'Yaoundé, CM' })

      expect(res.status).toBe(403)
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post('/warehouses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'x' }) // name too short, missing location

      expect(res.status).toBe(400)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/warehouses')
        .send({ name: 'Test Warehouse', location: 'Yaoundé, CM' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /warehouses', () => {
    it('should return all warehouses when authenticated', async () => {
      const res = await request(app)
        .get('/warehouses')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get('/warehouses')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /warehouses/:warehouse_id', () => {
    it('should return warehouse by id', async () => {
      const res = await request(app)
        .get(`/warehouses/${warehouseId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data.id).toBe(warehouseId)
    })

    it('should return 404 if warehouse not found', async () => {
      const res = await request(app)
        .get('/warehouses/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get(`/warehouses/${warehouseId}`)
      expect(res.status).toBe(401)
    })
  })

  describe('PUT /warehouses/:warehouse_id', () => {
    it('should update warehouse when admin', async () => {
      const res = await request(app)
        .put(`/warehouses/${warehouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Warehouse Updated', capacity: 1000 })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data.name).toBe('Test Warehouse Updated')
      expect(res.body.data.capacity).toBe(1000)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .put(`/warehouses/${warehouseId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Hacked Warehouse' })

      expect(res.status).toBe(403)
    })

    it('should return 404 if warehouse not found', async () => {
      const res = await request(app)
        .put('/warehouses/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Warehouse' })

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put(`/warehouses/${warehouseId}`)
        .send({ name: 'Test' })

      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /warehouses/:warehouse_id', () => {
    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .delete(`/warehouses/${warehouseId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 404 if warehouse not found', async () => {
      const res = await request(app)
        .delete('/warehouses/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).delete(`/warehouses/${warehouseId}`)
      expect(res.status).toBe(401)
    })

    it('should delete warehouse when admin', async () => {
      const res = await request(app)
        .delete(`/warehouses/${warehouseId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('message', 'Warehouse deleted successfully')
    })
  })
})