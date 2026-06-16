import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Address Integration', () => {
  const timestamp = Date.now()
  const userCredentials = {
    username: `address_user_${timestamp}`,
    email: `address_user_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Address',
    lastName: 'User',
    age: 25,
  }
  const otherUserCredentials = {
    username: `address_other_${timestamp}`,
    email: `address_other_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Other',
    lastName: 'User',
    age: 25,
  }

  const validAddress = {
    street: '123 Rue Principale',
    city: 'Yaoundé',
    country: 'Cameroon',
    postalCode: '00000',
    isDefault: false,
  }

  let userToken: string
  let otherUserToken: string
  let addressId: string

  beforeAll(async () => {
    const userRes = await request(app).post('/signup').send(userCredentials)
    userToken = userRes.body.data.token

    const otherRes = await request(app).post('/signup').send(otherUserCredentials)
    otherUserToken = otherRes.body.data.token
  })

  afterAll(async () => {
    await prisma.address.deleteMany({
      where: { user: { username: { in: [userCredentials.username, otherUserCredentials.username] } } },
    })
    await prisma.user.deleteMany({
      where: {
        username: { in: [userCredentials.username, otherUserCredentials.username] },
      },
    })
    await prisma.$disconnect()
    await getRedis().quit()
  })

  describe('POST /address/validate', () => {
    it('should validate a valid address', async () => {
      const res = await request(app)
        .post('/address/validate')
        .send({
          street: '123 Rue Principale',
          city: 'Yaoundé',
          country: 'CM',
          postal_code: '00000',
        })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data.valid).toBe(true)
      expect(res.body.data.normalized_address).not.toBeNull()
    })

    it('should return invalid for unsupported country', async () => {
      const res = await request(app)
        .post('/address/validate')
        .send({
          street: '123 Main St',
          city: 'Tokyo',
          country: 'Japan',
          postal_code: '100-0001',
        })

      expect(res.status).toBe(200)
      expect(res.body.data.valid).toBe(false)
      expect(res.body.data.normalized_address).toBeNull()
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post('/address/validate')
        .send({ street: '123' }) // missing required fields

      expect(res.status).toBe(400)
    })

    it('should work without authentication', async () => {
      const res = await request(app)
        .post('/address/validate')
        .send({
          street: '10 Downing Street',
          city: 'London',
          country: 'GB',
          postal_code: 'SW1A 2AA',
        })

      expect(res.status).toBe(200)
      expect(res.body.data.valid).toBe(true)
    })
  })

  describe('POST /addresses', () => {
    it('should create an address', async () => {
      const res = await request(app)
        .post('/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validAddress)

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.city).toBe('Yaoundé')
      expect(res.body.data.isDefault).toBe(false)
      addressId = res.body.data.id
    })

    it('should create a default address and unset previous defaults', async () => {
      // First create a default address
      const res1 = await request(app)
        .post('/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validAddress, city: 'Douala', isDefault: true })

      expect(res1.status).toBe(201)
      expect(res1.body.data.isDefault).toBe(true)

      // Create another default address
      const res2 = await request(app)
        .post('/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validAddress, city: 'Bafoussam', isDefault: true })

      expect(res2.status).toBe(201)
      expect(res2.body.data.isDefault).toBe(true)

      // Verify previous default is now unset
      const allRes = await request(app)
        .get('/addresses')
        .set('Authorization', `Bearer ${userToken}`)

      const defaults = allRes.body.data.filter((a: { isDefault: boolean }) => a.isDefault)
      expect(defaults).toHaveLength(1)
      expect(defaults[0].city).toBe('Bafoussam')
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post('/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ street: 'x' }) // too short, missing fields

      expect(res.status).toBe(400)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).post('/addresses').send(validAddress)
      expect(res.status).toBe(401)
    })
  })

  describe('GET /addresses', () => {
    it('should return all addresses for the authenticated user', async () => {
      const res = await request(app)
        .get('/addresses')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('should return only addresses belonging to the authenticated user', async () => {
      const res = await request(app)
        .get('/addresses')
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(0) // other user has no addresses
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get('/addresses')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /addresses/:addressId', () => {
    it('should return address by id', async () => {
      const res = await request(app)
        .get(`/addresses/${addressId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(addressId)
    })

    it('should return 403 if address belongs to another user', async () => {
      const res = await request(app)
        .get(`/addresses/${addressId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 404 if address not found', async () => {
      const res = await request(app)
        .get('/addresses/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get(`/addresses/${addressId}`)
      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /addresses/:addressId', () => {
    it('should update an address', async () => {
      const res = await request(app)
        .patch(`/addresses/${addressId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ city: 'Douala' })

      expect(res.status).toBe(200)
      expect(res.body.data.city).toBe('Douala')
    })

    it('should return 403 if address belongs to another user', async () => {
      const res = await request(app)
        .patch(`/addresses/${addressId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ city: 'Hacked' })

      expect(res.status).toBe(403)
    })

    it('should return 404 if address not found', async () => {
      const res = await request(app)
        .patch('/addresses/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ city: 'Douala' })

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .patch(`/addresses/${addressId}`)
        .send({ city: 'Douala' })

      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /addresses/:addressId', () => {
    it('should return 403 if address belongs to another user', async () => {
      const res = await request(app)
        .delete(`/addresses/${addressId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 404 if address not found', async () => {
      const res = await request(app)
        .delete('/addresses/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).delete(`/addresses/${addressId}`)
      expect(res.status).toBe(401)
    })

    it('should delete the address', async () => {
      const res = await request(app)
        .delete(`/addresses/${addressId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('message', 'Address deleted successfully')
    })
  })
})