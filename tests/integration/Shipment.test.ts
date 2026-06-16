import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/shared/config/database'
import { getRedis } from '../../src/shared/config/redis'

describe('Shipment Integration', () => {
  const timestamp = Date.now()
  const userCredentials = {
    username: `shipment_user_${timestamp}`,
    email: `shipment_user_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Shipment',
    lastName: 'User',
    age: 25,
  }
  const otherUserCredentials = {
    username: `shipment_other_${timestamp}`,
    email: `shipment_other_${timestamp}@example.com`,
    password: 'password123',
    firstName: 'Other',
    lastName: 'User',
    age: 25,
  }

  const validShipmentBody = {
    sender_name: 'Alice',
    sender_address: '1 Rue A, Yaoundé',
    recipient_name: 'Bob',
    recipient_address: '2 Rue B, Douala',
    weight: 3,
  }

  let userToken: string
  let otherUserToken: string
  let shipmentId: string
  let pickupRequestId: string

  beforeAll(async () => {
    const userRes = await request(app).post('/signup').send(userCredentials)
    userToken = userRes.body.data.token

    const otherRes = await request(app).post('/signup').send(otherUserCredentials)
    otherUserToken = otherRes.body.data.token
  })

  afterAll(async () => {
    await prisma.shippingLabel.deleteMany({ where: { shipmentId } })
    await prisma.trackingEvent.deleteMany({ where: { shipmentId } })
    await prisma.shipment.deleteMany({
      where: { senderName: { in: ['Alice', 'Cancel Test'] } },
    })
    await prisma.pickupRequest.deleteMany({
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

  describe('POST /shipments/cost', () => {
    it('should calculate shipping cost without auth', async () => {
      const res = await request(app)
        .post('/shipments/cost')
        .send({ origin: 'Yaoundé', destination: 'Douala', weight: 10 })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('cost')
      expect(res.body.data).toHaveProperty('currency', 'XAF')
      expect(res.body.data.cost).toBe(6) // 5 + 10*0.1
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post('/shipments/cost')
        .send({ origin: 'Yaoundé' }) // missing destination and weight

      expect(res.status).toBe(400)
    })
  })

  describe('POST /shipments', () => {
    it('should create a shipment', async () => {
      const res = await request(app)
        .post('/shipments')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validShipmentBody)

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data).toHaveProperty('trackingNumber')
      expect(res.body.data).toHaveProperty('estimatedDeliveryDate')
      expect(res.body.data.status).toBe('PENDING')
      shipmentId = res.body.data.id
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post('/shipments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ sender_name: 'Alice' }) // missing required fields

      expect(res.status).toBe(400)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).post('/shipments').send(validShipmentBody)
      expect(res.status).toBe(401)
    })
  })

  describe('GET /shipments/:shipmentId', () => {
    it('should return shipment by id', async () => {
      const res = await request(app)
        .get(`/shipments/${shipmentId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(shipmentId)
    })

    it('should return 404 if shipment not found', async () => {
      const res = await request(app)
        .get('/shipments/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 401 without token', async () => {
      const res = await request(app).get(`/shipments/${shipmentId}`)
      expect(res.status).toBe(401)
    })
  })

  describe('POST /shipments/:shipmentId/track', () => {
    it('should add a tracking event', async () => {
      const res = await request(app)
        .post(`/shipments/${shipmentId}/track`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'IN_TRANSIT', location: 'Yaoundé Centre' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data.status).toBe('IN_TRANSIT')
      expect(res.body.data.trackingEvents).toHaveLength(1)
      expect(res.body.data.trackingEvents[0].location).toBe('Yaoundé Centre')
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post(`/shipments/${shipmentId}/track`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({}) // missing status

      expect(res.status).toBe(400)
    })

    it('should return 404 if shipment not found', async () => {
      const res = await request(app)
        .post('/shipments/nonexistent-id/track')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'IN_TRANSIT' })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /shipments/:shipmentId/track', () => {
    it('should return tracking info', async () => {
      const res = await request(app)
        .get(`/shipments/${shipmentId}/track`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('current_status')
      expect(res.body.data).toHaveProperty('current_location')
      expect(res.body.data).toHaveProperty('updates')
      expect(Array.isArray(res.body.data.updates)).toBe(true)
    })

    it('should return 404 if shipment not found', async () => {
      const res = await request(app)
        .get('/shipments/nonexistent-id/track')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /labels/:shipmentId', () => {
    it('should return or create a shipping label', async () => {
      const res = await request(app)
        .get(`/labels/${shipmentId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('label_id')
      expect(res.body.data).toHaveProperty('label_url')
      expect(res.body.data.label_url).toContain(shipmentId)
    })

    it('should return the same label on second call', async () => {
      const res1 = await request(app)
        .get(`/labels/${shipmentId}`)
        .set('Authorization', `Bearer ${userToken}`)

      const res2 = await request(app)
        .get(`/labels/${shipmentId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res1.body.data.label_id).toBe(res2.body.data.label_id)
    })

    it('should return 404 if shipment not found', async () => {
      const res = await request(app)
        .get('/labels/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /shipments/:shipmentId/cancel', () => {
    it('should cancel a shipment', async () => {
      // Create a new shipment to cancel
      const createRes = await request(app)
        .post('/shipments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validShipmentBody, sender_name: 'Cancel Test' })
      const cancelId = createRes.body.data.id

      const res = await request(app)
        .post(`/shipments/${cancelId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('CANCELLED')
    })

    it('should return 400 if shipment already cancelled', async () => {
      // Cancel the same shipment again
      const createRes = await request(app)
        .post('/shipments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validShipmentBody, sender_name: 'Cancel Test' })
      const cancelId = createRes.body.data.id

      await request(app)
        .post(`/shipments/${cancelId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)

      const res = await request(app)
        .post(`/shipments/${cancelId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(400)
    })

    it('should return 404 if shipment not found', async () => {
      const res = await request(app)
        .post('/shipments/nonexistent-id/cancel')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /pickup-requests', () => {
    it('should create a pickup request', async () => {
      const res = await request(app)
        .post('/pickup-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ pickup_date: '2026-07-01', pickup_address: '1 Rue A, Yaoundé' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe(true)
      expect(res.body.data).toHaveProperty('id')
      expect(res.body.data.status).toBe('PENDING')
      pickupRequestId = res.body.data.id
    })

    it('should return 400 with invalid body', async () => {
      const res = await request(app)
        .post('/pickup-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ pickup_date: '2026-07-01' }) // missing pickup_address

      expect(res.status).toBe(400)
    })

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/pickup-requests')
        .send({ pickup_date: '2026-07-01', pickup_address: '1 Rue A' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /pickup-requests/:requestId', () => {
    it('should return pickup request by id', async () => {
      const res = await request(app)
        .get(`/pickup-requests/${pickupRequestId}`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(pickupRequestId)
    })

    it('should return 404 if not found', async () => {
      const res = await request(app)
        .get('/pickup-requests/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /pickup-requests/:requestId/cancel', () => {
    it('should return 403 if user does not own the pickup request', async () => {
      const res = await request(app)
        .post(`/pickup-requests/${pickupRequestId}/cancel`)
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(403)
    })

    it('should return 404 if pickup request not found', async () => {
      const res = await request(app)
        .post('/pickup-requests/nonexistent-id/cancel')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })

    it('should cancel the pickup request', async () => {
      const res = await request(app)
        .post(`/pickup-requests/${pickupRequestId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('CANCELLED')
    })

    it('should return 400 if already cancelled', async () => {
      const res = await request(app)
        .post(`/pickup-requests/${pickupRequestId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(400)
    })
  })
})