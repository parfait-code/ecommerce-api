import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('User Integration', () => {
  const timestamp = Date.now()
  const userCredentials = {
    username: `user_${timestamp}`,
    email: `user_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe',
    age: 28,
  }
  const adminCredentials = {
    username: `admin_${timestamp}`,
    email: `admin_${timestamp}@example.com`,
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    age: 35,
    role: 'admin',
  }

  let userToken: string
  let adminToken: string
  let userId: number
  let adminId: number

  beforeAll(async () => {
    // Create regular user
    const userRes = await request(app).post('/signup').send(userCredentials)
    userToken = userRes.body.data.token
    userId = userRes.body.data.user.id

    // Create admin user
    const adminRes = await request(app).post('/signup').send(adminCredentials)
    adminToken = adminRes.body.data.token
    adminId = adminRes.body.data.user.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        username: { in: [userCredentials.username, adminCredentials.username] },
      },
    })
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('GET /user', () => {
    it('should return the authenticated user profile', async () => {
      const res = await request(app)
        .get('/user')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('username', userCredentials.username)
      expect(res.body.data).not.toHaveProperty('password')
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get('/user')
      expect(res.status).toBe(401)
      expect(res.body.status).toBe(false)
    })
  })

  describe('PATCH /user', () => {
    it('should update the authenticated user profile', async () => {
      const res = await request(app)
        .patch('/user')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ firstName: 'UpdatedName' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('firstName', 'UpdatedName')
      expect(res.body.data).not.toHaveProperty('password')
    })

    it('should return 400 with invalid data', async () => {
      const res = await request(app)
        .patch('/user')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'not-an-email' })

      expect(res.status).toBe(400)
      expect(res.body.status).toBe(false)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).patch('/user').send({ firstName: 'X' })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /user/all', () => {
    it('should return all users when admin', async () => {
      const res = await request(app)
        .get('/user/all')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      // No password should be exposed
      res.body.data.forEach((u: Record<string, unknown>) => {
        expect(u).not.toHaveProperty('password')
      })
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .get('/user/all')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
      expect(res.body.status).toBe(false)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get('/user/all')
      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /user/change-role/:userId', () => {
    it('should change user role when admin', async () => {
      const res = await request(app)
        .patch(`/user/change-role/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data).not.toHaveProperty('password')
    })

    it('should return 400 with invalid role', async () => {
      const res = await request(app)
        .patch(`/user/change-role/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superuser' })

      expect(res.status).toBe(400)
    })

    it('should return 403 when regular user', async () => {
      const res = await request(app)
        .patch(`/user/change-role/${adminId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'user' })

      expect(res.status).toBe(403)
    })
  })

  describe('DELETE /user/:userId', () => {
    it('should return 403 when regular user tries to delete', async () => {
      const res = await request(app)
        .delete(`/user/${adminId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 404 when user not found', async () => {
      const res = await request(app)
        .delete('/user/999999')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
    })

    it('should delete user when admin', async () => {
      // Create a temp user to delete
      const tempRes = await request(app).post('/signup').send({
        username: `temp_${timestamp}`,
        email: `temp_${timestamp}@example.com`,
        password: 'password123',
        firstName: 'Temp',
        lastName: 'User',
        age: 20,
      })
      const tempId = tempRes.body.data.user.id

      const res = await request(app)
        .delete(`/user/${tempId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('numberOfUsersDeleted', 1)
    })
  })
})