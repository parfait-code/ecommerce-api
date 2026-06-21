// tests/integration/products.integration.test.ts
import { api } from "./setup/app";
import {
  cleanProducts,
  cleanCategories,
  cleanUsers,
  seedUser,
  seedCategory,
  seedProduct,
} from "./setup/db";
import { adminToken, userToken } from "./setup/auth";
import { prisma } from "../../src/shared/config/database";

const TS = Date.now();

describe("[Integration] Products", () => {
  let adminUser: Awaited<ReturnType<typeof seedUser>>;
  let regularUser: Awaited<ReturnType<typeof seedUser>>;
  let adminTok: string;
  let userTok: string;
  let categoryId: string;
  let createdProductId: number;

  beforeAll(async () => {
    adminUser = await seedUser({
      username: `test_admin_prod_${TS}`,
      email: `test_admin_prod_${TS}@example.com`,
      role: "ADMIN",
    });
    regularUser = await seedUser({
      username: `test_user_prod_${TS}`,
      email: `test_user_prod_${TS}@example.com`,
      role: "USER",
    });
    adminTok = adminToken(adminUser.id);
    userTok = userToken(regularUser.id);

    const category = await seedCategory({ slug: `test-cat-prod-${TS}` });
    categoryId = category.id;
  });

  afterAll(async () => {
    await cleanProducts();
    await cleanCategories();
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── GET /product ──────────────────────────────────────────────────────────

  describe("GET /product", () => {
    it("200 — retourne la liste paginée sans auth", async () => {
      const res = await api.get("/product");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("total");
      expect(res.body.data).toHaveProperty("page");
      expect(res.body.data).toHaveProperty("limit");
      expect(res.body.data).toHaveProperty("totalPages");
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it("200 — filtre par categoryId", async () => {
      const res = await api.get(`/product?categoryId=${categoryId}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
    });

    it("200 — pagination page/limit", async () => {
      const res = await api.get("/product?page=1&limit=5");

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(5);
      expect(res.body.data.page).toBe(1);
    });
  });

  // ── POST /product ─────────────────────────────────────────────────────────

  describe("POST /product", () => {
    it("201 — crée un produit (admin)", async () => {
      const res = await api
        .post("/product")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          sku: `TEST-PROD-${TS}`,
          name: `Test Product ${TS}`,
          price: 9999,
          categoryId,
          status: "ACTIVE",
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.sku).toBe(`TEST-PROD-${TS}`);
      expect(res.body.data.price).toBe(9999);
      expect(res.body.data.category.id).toBe(categoryId);

      createdProductId = res.body.data.id;
    });

    it("400 — rejette si sku manquant", async () => {
      const res = await api
        .post("/product")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          name: `Test Product Missing SKU ${TS}`,
          price: 1000,
          categoryId,
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("400 — rejette si price négatif", async () => {
      const res = await api
        .post("/product")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          sku: `TEST-NEG-${TS}`,
          name: `Test Negative Price ${TS}`,
          price: -100,
          categoryId,
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .post("/product")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          sku: `TEST-FORBIDDEN-${TS}`,
          name: `Test Forbidden ${TS}`,
          price: 1000,
          categoryId,
        });

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.post("/product").send({
        sku: `TEST-UNAUTH-${TS}`,
        name: `Test Unauth ${TS}`,
        price: 1000,
        categoryId,
      });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /product/:productId ───────────────────────────────────────────────

  describe("GET /product/:productId", () => {
    it("200 — retourne un produit par ID sans auth", async () => {
      const res = await api.get(`/product/${createdProductId}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(createdProductId);
      expect(res.body.data).toHaveProperty("images");
      expect(res.body.data).toHaveProperty("variants");
    });

    it("404 — produit introuvable", async () => {
      const res = await api.get("/product/999999");

      expect(res.status).toBe(404);
      expect(res.body.status).toBe(false);
    });
  });

  // ── PATCH /product/:productId ─────────────────────────────────────────────

  describe("PATCH /product/:productId", () => {
    it("200 — met à jour un produit (admin)", async () => {
      const res = await api
        .patch(`/product/${createdProductId}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ name: `Test Product Updated ${TS}`, price: 12000 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.name).toBe(`Test Product Updated ${TS}`);
      expect(res.body.data.price).toBe(12000);
    });

    it("200 — met à jour le statut", async () => {
      const res = await api
        .patch(`/product/${createdProductId}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ status: "ARCHIVED" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("ARCHIVED");
    });

    it("400 — rejette un statut invalide", async () => {
      const res = await api
        .patch(`/product/${createdProductId}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ status: "INVALID_STATUS" });

      expect(res.status).toBe(400);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .patch(`/product/${createdProductId}`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ name: "Hacked" });

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api
        .patch(`/product/${createdProductId}`)
        .send({ name: "Hacked" });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /product/:productId ────────────────────────────────────────────

  describe("DELETE /product/:productId", () => {
    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .delete(`/product/${createdProductId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.delete(`/product/${createdProductId}`);
      expect(res.status).toBe(401);
    });

    it("200 — supprime (soft delete) un produit (admin)", async () => {
      const product = await seedProduct(categoryId, {
        sku: `TEST-TO-DELETE-${TS}`,
      });

      const res = await api
        .delete(`/product/${product.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.numberOfProductsDeleted).toBe(1);
    });

    it("404 — produit introuvable après soft delete", async () => {
      const product = await seedProduct(categoryId, {
        sku: `TEST-DELETED-CHECK-${TS}`,
      });
      await api
        .delete(`/product/${product.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      const res = await api.get(`/product/${product.id}`);
      expect(res.status).toBe(404);
    });
  });
});
