// tests/integration/checkout.test.ts
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/shared/config/database";
import { getRedis } from "../../src/shared/config/redis";

describe("Checkout Integration", () => {
  const timestamp = Date.now();
  const userCredentials = {
    username: `checkout_user_${timestamp}`,
    email: `checkout_user_${timestamp}@example.com`,
    password: "password123",
    firstName: "Checkout",
    lastName: "User",
    age: 25,
  };
  const adminCredentials = {
    username: `checkout_admin_${timestamp}`,
    email: `checkout_admin_${timestamp}@example.com`,
    password: "admin123",
    firstName: "Admin",
    lastName: "User",
    age: 30,
    role: "admin",
  };

  const shippingAddress = {
    street: "123 Rue Principale",
    city: "Yaoundé",
    country: "CM",
    postalCode: "00000",
  };

  let userToken: string;
  let adminToken: string;
  let productId: number;
  let categoryId: string;
  let basketId: string;
  let checkoutId: string;

  beforeAll(async () => {
    const userRes = await request(app).post("/signup").send(userCredentials);
    userToken = userRes.body.data.token;

    const adminRes = await request(app).post("/signup").send(adminCredentials);
    adminToken = adminRes.body.data.token;

    const catRes = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Checkout Category ${timestamp}`,
        slug: `checkout-category-${timestamp}`,
      });
    categoryId = catRes.body.data.id;

    const productRes = await request(app)
      .post("/product")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Checkout Test Product",
        description: "Product for checkout tests",
        price: 60.0,
        categoryId,
        stock: 50,
      });
    productId = productRes.body.data.id;

    const basketRes = await request(app)
      .post("/basket")
      .set("Authorization", `Bearer ${userToken}`);
    basketId = basketRes.body.data.id;

    await request(app)
      .post(`/basket/${basketId}/product`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ product_id: productId, quantity: 2 });
  });

  afterAll(async () => {
    await prisma.checkout.deleteMany({
      where: { user: { username: userCredentials.username } },
    });
    await prisma.orderItem.deleteMany({
      where: { product: { name: "Checkout Test Product" } },
    });
    await prisma.order.deleteMany({
      where: { user: { username: userCredentials.username } },
    });
    await prisma.basketItem.deleteMany({ where: { basketId } });
    await prisma.basket.deleteMany({ where: { id: basketId } });
    await prisma.product.deleteMany({
      where: { name: "Checkout Test Product" },
    });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({
      where: {
        username: { in: [userCredentials.username, adminCredentials.username] },
      },
    });
    await prisma.$disconnect();
    await getRedis().quit();
  });

  describe("POST /checkout", () => {
    it("should create a checkout from a basket", async () => {
      const res = await request(app)
        .post("/checkout")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ basket_id: basketId, shipping_address: shippingAddress });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.total).toBe(120);
      expect(res.body.data.status).toBe("PENDING");
      checkoutId = res.body.data.id;
    });

    it("should return 404 if basket not found", async () => {
      const res = await request(app)
        .post("/checkout")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          basket_id: "nonexistent-basket",
          shipping_address: shippingAddress,
        });

      expect(res.status).toBe(404);
    });

    it("should return 400 if basket is empty", async () => {
      const emptyBasketRes = await request(app)
        .post("/basket")
        .set("Authorization", `Bearer ${userToken}`);
      const emptyBasketId = emptyBasketRes.body.data.id;

      const res = await request(app)
        .post("/checkout")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ basket_id: emptyBasketId, shipping_address: shippingAddress });

      expect(res.status).toBe(400);

      await prisma.basket.deleteMany({ where: { id: emptyBasketId } });
    });

    it("should return 400 with invalid body", async () => {
      const res = await request(app)
        .post("/checkout")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ basket_id: basketId }); // missing shipping_address

      expect(res.status).toBe(400);
    });

    it("should return 401 without token", async () => {
      const res = await request(app)
        .post("/checkout")
        .send({ basket_id: basketId, shipping_address: shippingAddress });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /checkout/:checkout_id", () => {
    it("should return checkout by id", async () => {
      const res = await request(app)
        .get(`/checkout/${checkoutId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(checkoutId);
    });

    it("should return 404 if checkout not found", async () => {
      const res = await request(app)
        .get("/checkout/nonexistent-id")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });

    it("should return 401 without token", async () => {
      const res = await request(app).get(`/checkout/${checkoutId}`);
      expect(res.status).toBe(401);
    });
  });

  describe("POST /checkout/:checkout_id/complete", () => {
    it("should complete the checkout and create an order", async () => {
      const res = await request(app)
        .post(`/checkout/${checkoutId}/complete`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.status).toBe("COMPLETED");
      expect(res.body.data).toHaveProperty("orderId");
      expect(res.body.data.orderId).not.toBeNull();
    });

    it("should return 400 if checkout already completed", async () => {
      const res = await request(app)
        .post(`/checkout/${checkoutId}/complete`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(400);
    });

    it("should return 403 if user does not own the checkout", async () => {
      const newBasketRes = await request(app)
        .post("/basket")
        .set("Authorization", `Bearer ${userToken}`);
      const newBasketId = newBasketRes.body.data.id;

      await request(app)
        .post(`/basket/${newBasketId}/product`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ product_id: productId, quantity: 1 });

      const newCheckoutRes = await request(app)
        .post("/checkout")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ basket_id: newBasketId, shipping_address: shippingAddress });
      const newCheckoutId = newCheckoutRes.body.data.id;

      const res = await request(app)
        .post(`/checkout/${newCheckoutId}/complete`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(403);

      await prisma.checkout.deleteMany({ where: { id: newCheckoutId } });
      await prisma.basketItem.deleteMany({ where: { basketId: newBasketId } });
      await prisma.basket.deleteMany({ where: { id: newBasketId } });
    });

    it("should return 404 if checkout not found", async () => {
      const res = await request(app)
        .post("/checkout/nonexistent-id/complete")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });
});
