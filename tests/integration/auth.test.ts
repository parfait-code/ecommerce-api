import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Auth Integration', () => {
  const timestamp = Date.now()
  const testUser = {
    username: `testuser_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    age: 25,
  }

  afterAll(async () => {
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('POST /signup', () => {
    it('should create a new user', async () => {
      const res = await request(app).post('/signup').send(testUser)
      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('token')
      expect(res.body.data.user).not.toHaveProperty('password')
    })

    it('should return 409 if username already taken', async () => {
      const res = await request(app).post('/signup').send(testUser)
      expect(res.status).toBe(409)
      expect(res.body.status).toBe(false)
    })

    it('should return 400 if body is invalid', async () => {
      const res = await request(app).post('/signup').send({ username: 'x' })
      expect(res.status).toBe(400)
      expect(res.body.status).toBe(false)
    })
  })

  describe('POST /login', () => {
    it('should login and return token', async () => {
      const res = await request(app)
        .post('/login')
        .send({ username: testUser.username, password: testUser.password })
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('token')
    })

    it('should return 400 if username not found', async () => {
      const res = await request(app)
        .post('/login')
        .send({ username: 'unknown_user', password: 'pass' })
      expect(res.status).toBe(400)
    })

    it('should return 400 if password wrong', async () => {
      const res = await request(app)
        .post('/login')
        .send({ username: testUser.username, password: 'wrongpassword' })
      expect(res.status).toBe(400)
    })
  })
})