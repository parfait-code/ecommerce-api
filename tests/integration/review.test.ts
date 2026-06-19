// tests/integration/review.test.ts
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/shared/config/database";
import { getRedis } from "../../src/shared/config/redis";

describe("Review Integration", () => {
  const timestamp = Date.now();
  const userCredentials = {
    username: `review_user_${timestamp}`,
    email: `review_user_${timestamp}@example.com`,
    password: "password123",
    firstName: "Review",
    lastName: "User",
    age: 25,
  };
  const otherUserCredentials = {
    username: `review_other_${timestamp}`,
    email: `review_other_${timestamp}@example.com`,
    password: "password123",
    firstName: "Other",
    lastName: "User",
    age: 25,
  };
  const adminCredentials = {
    username: `review_admin_${timestamp}`,
    email: `review_admin_${timestamp}@example.com`,
    password: "admin123",
    firstName: "Admin",
    lastName: "User",
    age: 30,
    role: "admin",
  };

  let userToken: string;
  let otherUserToken: string;
  let adminToken: string;
  let productId: number;
  let categoryId: string;
  let reviewId: string;

  beforeAll(async () => {
    const userRes = await request(app).post("/signup").send(userCredentials);
    userToken = userRes.body.data.token;

    const otherRes = await request(app)
      .post("/signup")
      .send(otherUserCredentials);
    otherUserToken = otherRes.body.data.token;

    const adminRes = await request(app).post("/signup").send(adminCredentials);
    adminToken = adminRes.body.data.token;

    const catRes = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Review Category ${timestamp}`,
        slug: `review-category-${timestamp}`,
      });
    categoryId = catRes.body.data.id;

    const productRes = await request(app)
      .post("/product")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Review Test Product",
        description: "Product for review tests",
        price: 45.0,
        categoryId,
        stock: 20,
      });
    productId = productRes.body.data.id;
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { name: "Review Test Product" } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({
      where: {
        username: {
          in: [
            userCredentials.username,
            otherUserCredentials.username,
            adminCredentials.username,
          ],
        },
      },
    });
    await prisma.$disconnect();
    await getRedis().quit();
  });

  describe("GET /products/:pid/reviews", () => {
    it("should return reviews for a product (empty initially)", async () => {
      const res = await request(app).get(`/products/${productId}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.product_id).toBe(productId);
      expect(res.body.data.total_reviews).toBe(0);
      expect(res.body.data.average_rating).toBe(0);
      expect(res.body.data.reviews).toHaveLength(0);
    });

    it("should return 404 if product not found", async () => {
      const res = await request(app).get("/products/999999/reviews");

      expect(res.status).toBe(404);
      expect(res.body.status).toBe(false);
    });
  });

  describe("POST /reviews", () => {
    it("should create a review", async () => {
      const res = await request(app)
        .post("/reviews")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ product_id: productId, rating: 4, comment: "Great product!" });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.rating).toBe(4);
      expect(res.body.data.comment).toBe("Great product!");
      expect(res.body.data.user).not.toHaveProperty("password");
      reviewId = res.body.data.id;
    });

    it("should return 409 if user already reviewed this product", async () => {
      const res = await request(app)
        .post("/reviews")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ product_id: productId, rating: 5, comment: "Trying again" });

      expect(res.status).toBe(409);
      expect(res.body.status).toBe(false);
    });

    it("should return 404 if product not found", async () => {
      const res = await request(app)
        .post("/reviews")
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send({ product_id: 999999, rating: 3 });

      expect(res.status).toBe(404);
    });

    it("should return 400 with invalid rating", async () => {
      const res = await request(app)
        .post("/reviews")
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send({ product_id: productId, rating: 10 }); // max is 5

      expect(res.status).toBe(400);
    });

    it("should return 400 with missing fields", async () => {
      const res = await request(app)
        .post("/reviews")
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send({ product_id: productId }); // missing rating

      expect(res.status).toBe(400);
    });

    it("should return 401 without token", async () => {
      const res = await request(app)
        .post("/reviews")
        .send({ product_id: productId, rating: 4 });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /products/:pid/reviews (after creation)", () => {
    it("should return reviews with correct average rating", async () => {
      // otherUser adds a review (rating 5)
      await request(app)
        .post("/reviews")
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send({ product_id: productId, rating: 5, comment: "Excellent!" });

      const res = await request(app).get(`/products/${productId}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.data.total_reviews).toBe(2);
      expect(res.body.data.average_rating).toBe(4.5); // (4 + 5) / 2
    });
  });

  describe("GET /reviews/:rid", () => {
    it("should return review by id", async () => {
      const res = await request(app).get(`/reviews/${reviewId}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(reviewId);
    });

    it("should return 404 if review not found", async () => {
      const res = await request(app).get("/reviews/nonexistent-id");

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /reviews/:rid", () => {
    it("should update own review", async () => {
      const res = await request(app)
        .put(`/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ rating: 5, comment: "Updated comment!" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.comment).toBe("Updated comment!");
    });

    it("should return 403 if user does not own the review", async () => {
      const res = await request(app)
        .put(`/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send({ rating: 1 });

      expect(res.status).toBe(403);
    });

    it("should return 400 with invalid rating", async () => {
      const res = await request(app)
        .put(`/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ rating: 0 }); // min is 1

      expect(res.status).toBe(400);
    });

    it("should return 404 if review not found", async () => {
      const res = await request(app)
        .put("/reviews/nonexistent-id")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ rating: 3 });

      expect(res.status).toBe(404);
    });

    it("should return 401 without token", async () => {
      const res = await request(app)
        .put(`/reviews/${reviewId}`)
        .send({ rating: 3 });

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /reviews/:rid", () => {
    it("should return 403 if user does not own the review", async () => {
      const res = await request(app)
        .delete(`/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
    });

    it("should return 404 if review not found", async () => {
      const res = await request(app)
        .delete("/reviews/nonexistent-id")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });

    it("should return 401 without token", async () => {
      const res = await request(app).delete(`/reviews/${reviewId}`);
      expect(res.status).toBe(401);
    });

    it("should delete own review", async () => {
      const res = await request(app)
        .delete(`/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty("id", reviewId);
    });
  });
});
