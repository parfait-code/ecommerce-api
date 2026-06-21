// tests/integration/basket.integration.test.ts
import { api } from "./setup/app";
import {
  cleanBaskets,
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

describe("[Integration] Basket", () => {
  let adminUser: Awaited<ReturnType<typeof seedUser>>;
  let regularUser: Awaited<ReturnType<typeof seedUser>>;
  let adminTok: string;
  let userTok: string;
  let categoryId: string;
  let productId: number;
  let product2Id: number;
  let basketId: string;

  beforeAll(async () => {
    adminUser = await seedUser({
      username: `test_admin_basket_${TS}`,
      email: `test_admin_basket_${TS}@example.com`,
      role: "ADMIN",
    });
    regularUser = await seedUser({
      username: `test_user_basket_${TS}`,
      email: `test_user_basket_${TS}@example.com`,
      role: "USER",
    });
    adminTok = adminToken(adminUser.id);
    userTok = userToken(regularUser.id);

    const category = await seedCategory({ slug: `test-cat-basket-${TS}` });
    categoryId = category.id;

    const product = await seedProduct(categoryId, {
      sku: `TEST-BASKET-P1-${TS}`,
      name: `Test Basket Product 1 ${TS}`,
      price: 2000,
    });
    productId = product.id;

    const product2 = await seedProduct(categoryId, {
      sku: `TEST-BASKET-P2-${TS}`,
      name: `Test Basket Product 2 ${TS}`,
      price: 5000,
    });
    product2Id = product2.id;
  });

  afterAll(async () => {
    await cleanBaskets();
    await cleanProducts();
    await cleanCategories();
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── POST /basket ──────────────────────────────────────────────────────────

  describe("POST /basket", () => {
    it("201 — crée un panier", async () => {
      const res = await api
        .post("/basket")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.items).toEqual([]);

      basketId = res.body.data.id;
    });

    it("201 — un utilisateur peut avoir plusieurs paniers", async () => {
      const res = await api
        .post("/basket")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(201);
      expect(res.body.data.id).not.toBe(basketId);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.post("/basket");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /basket/:basket_id ────────────────────────────────────────────────

  describe("GET /basket/:basket_id", () => {
    it("200 — retourne le panier", async () => {
      const res = await api
        .get(`/basket/${basketId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(basketId);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it("404 — panier introuvable", async () => {
      const res = await api
        .get("/basket/nonexistent-id")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get(`/basket/${basketId}`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /basket/:basket_id/product ───────────────────────────────────────

  describe("POST /basket/:basket_id/product", () => {
    it("200 — ajoute un produit au panier", async () => {
      const res = await api
        .post(`/basket/${basketId}/product`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: productId, quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].productId).toBe(productId);
      expect(res.body.data.items[0].quantity).toBe(2);
    });

    it("200 — incrémente la quantité si le produit est déjà dans le panier", async () => {
      const res = await api
        .post(`/basket/${basketId}/product`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: productId, quantity: 3 });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it("200 — ajoute un second produit différent", async () => {
      const res = await api
        .post(`/basket/${basketId}/product`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: product2Id, quantity: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
    });

    it("404 — produit introuvable", async () => {
      const res = await api
        .post(`/basket/${basketId}/product`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: 999999, quantity: 1 });

      expect(res.status).toBe(404);
    });

    it("400 — rejette si quantity = 0", async () => {
      const res = await api
        .post(`/basket/${basketId}/product`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: productId, quantity: 0 });

      expect(res.status).toBe(400);
    });

    it("400 — rejette si product_id manquant", async () => {
      const res = await api
        .post(`/basket/${basketId}/product`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ quantity: 1 });

      expect(res.status).toBe(400);
    });

    it("404 — panier introuvable", async () => {
      const res = await api
        .post("/basket/nonexistent-id/product")
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: productId, quantity: 1 });

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api
        .post(`/basket/${basketId}/product`)
        .send({ product_id: productId, quantity: 1 });

      expect(res.status).toBe(401);
    });
  });

  // ── PUT /basket/:basket_id/product/quantity ───────────────────────────────

  describe("PUT /basket/:basket_id/product/quantity", () => {
    it("200 — met à jour la quantité d'un article", async () => {
      const res = await api
        .put(`/basket/${basketId}/product/quantity`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: productId, quantity: 10 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      const item = res.body.data.items.find(
        (i: any) => i.productId === productId,
      );
      expect(item.quantity).toBe(10);
    });

    it("404 — produit absent du panier", async () => {
      const orphanProduct = await seedProduct(categoryId, {
        sku: `TEST-BASKET-ORPHAN-${TS}`,
      });

      const res = await api
        .put(`/basket/${basketId}/product/quantity`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: orphanProduct.id, quantity: 5 });

      expect(res.status).toBe(404);
    });

    it("400 — rejette si quantity manquante", async () => {
      const res = await api
        .put(`/basket/${basketId}/product/quantity`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: productId });

      expect(res.status).toBe(400);
    });

    it("401 — rejette sans token", async () => {
      const res = await api
        .put(`/basket/${basketId}/product/quantity`)
        .send({ product_id: productId, quantity: 1 });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /basket/:basket_id/product ─────────────────────────────────────

  describe("DELETE /basket/:basket_id/product", () => {
    it("200 — retire un produit du panier", async () => {
      const res = await api
        .delete(`/basket/${basketId}/product`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: product2Id });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      const item = res.body.data.items.find(
        (i: any) => i.productId === product2Id,
      );
      expect(item).toBeUndefined();
    });

    it("404 — produit absent du panier", async () => {
      const res = await api
        .delete(`/basket/${basketId}/product`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ product_id: product2Id });

      expect(res.status).toBe(404);
    });

    it("400 — rejette si product_id manquant", async () => {
      const res = await api
        .delete(`/basket/${basketId}/product`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("401 — rejette sans token", async () => {
      const res = await api
        .delete(`/basket/${basketId}/product`)
        .send({ product_id: productId });

      expect(res.status).toBe(401);
    });
  });
});
