// tests/integration/orders.integration.test.ts
import { api } from "./setup/app";
import {
  cleanOrders,
  cleanBaskets,
  cleanProducts,
  cleanCategories,
  cleanAddresses,
  cleanUsers,
  cleanPromotions,
  cleanCouponUses,
  seedUser,
  seedCategory,
  seedProduct,
  seedAddress,
  seedBasket,
  seedPromotion,
} from "./setup/db";
import { adminToken, userToken } from "./setup/auth";
import { prisma } from "../../src/shared/config/database";

const TS = Date.now();

describe("[Integration] Orders", () => {
  let adminUser: Awaited<ReturnType<typeof seedUser>>;
  let regularUser: Awaited<ReturnType<typeof seedUser>>;
  let otherUser: Awaited<ReturnType<typeof seedUser>>;
  let adminTok: string;
  let userTok: string;
  let otherTok: string;
  let categoryId: string;
  let productId: number;
  let product2Id: number;
  let addressId: string;
  let basketId: string;
  let createdOrderId: string;

  const shippingAddress = {
    street: "1 rue de Test",
    city: "Yaoundé",
    country: "CM",
    postalCode: "0000",
  };

  beforeAll(async () => {
    adminUser = await seedUser({
      username: `test_admin_ord_${TS}`,
      email: `test_admin_ord_${TS}@example.com`,
      role: "ADMIN",
    });
    regularUser = await seedUser({
      username: `test_user_ord_${TS}`,
      email: `test_user_ord_${TS}@example.com`,
      role: "USER",
    });
    otherUser = await seedUser({
      username: `test_other_ord_${TS}`,
      email: `test_other_ord_${TS}@example.com`,
      role: "USER",
    });
    adminTok = adminToken(adminUser.id);
    userTok = userToken(regularUser.id);
    otherTok = userToken(otherUser.id);

    const category = await seedCategory({ slug: `test-cat-ord-${TS}` });
    categoryId = category.id;

    const product = await seedProduct(categoryId, {
      sku: `TEST-ORD-P1-${TS}`,
      price: 3000,
    });
    productId = product.id;

    const product2 = await seedProduct(categoryId, {
      sku: `TEST-ORD-P2-${TS}`,
      price: 5000,
    });
    product2Id = product2.id;

    const address = await seedAddress(regularUser.id);
    addressId = address.id;

    // Créer un panier et y ajouter un produit
    const basket = await seedBasket(regularUser.id);
    basketId = basket.id;
    await prisma.basketItem.create({
      data: { basketId, productId, quantity: 2 },
    });
  });

  afterAll(async () => {
    await cleanCouponUses();
    await cleanOrders();
    await cleanBaskets();
    await cleanAddresses();
    await cleanProducts();
    await cleanCategories();
    await cleanPromotions();
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── POST /orders ──────────────────────────────────────────────────────────

  describe("POST /orders", () => {
    it("201 — crée une commande", async () => {
      const basketItem = await prisma.basketItem.findFirst({
        where: { basketId },
      });

      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          items: [{ id: String(productId), quantity: 2 }],
          shippingAddress,
          shippingAddressId: addressId,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.totalAmount).toBe(6000);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.statusHistory).toHaveLength(1);

      createdOrderId = res.body.data.id;
    });

    it("201 — crée une commande avec coupon valide", async () => {
      const promo = await seedPromotion({
        slug: `test-promo-ord-${TS}`,
      });
      const couponCode = `TESTORD${TS}`.slice(0, 15).toUpperCase();
      await prisma.couponCode.create({
        data: {
          promotionId: promo.id,
          code: couponCode,
          maxUses: 100,
          perUserLimit: 1,
          isActive: true,
        },
      });

      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          items: [{ id: String(productId), quantity: 1 }],
          shippingAddress,
          couponCode,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.appliedCoupon).not.toBeNull();
      expect(res.body.data.appliedCoupon.code).toBe(couponCode);
    });

    it("404 — rejette si un produit est introuvable", async () => {
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          items: [{ id: "999999", quantity: 1 }],
          shippingAddress,
        });

      expect(res.status).toBe(404);
    });

    it("400 — rejette si items est vide", async () => {
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${userTok}`)
        .send({ items: [], shippingAddress });

      expect(res.status).toBe(400);
    });

    it("400 — rejette si shippingAddress manquant", async () => {
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${userTok}`)
        .send({ items: [{ id: String(productId), quantity: 1 }] });

      expect(res.status).toBe(400);
    });

    it("404 — rejette un coupon inexistant", async () => {
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          items: [{ id: String(productId), quantity: 1 }],
          shippingAddress,
          couponCode: "INVALID_COUPON_CODE",
        });

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.post("/orders").send({
        items: [{ id: String(productId), quantity: 1 }],
        shippingAddress,
      });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /orders ───────────────────────────────────────────────────────────

  describe("GET /orders", () => {
    it("200 — retourne la liste paginée des commandes", async () => {
      const res = await api
        .get("/orders")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("total");
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it("200 — filtre par status", async () => {
      const res = await api
        .get("/orders?status=PENDING")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      res.body.data.items.forEach((o: any) => {
        expect(o.status).toBe("PENDING");
      });
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/orders");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /orders/:orderId ──────────────────────────────────────────────────

  describe("GET /orders/:orderId", () => {
    it("200 — retourne une commande par ID", async () => {
      const res = await api
        .get(`/orders/${createdOrderId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(createdOrderId);
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("statusHistory");
    });

    it("404 — commande introuvable", async () => {
      const res = await api
        .get("/orders/nonexistent-id")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get(`/orders/${createdOrderId}`);
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /orders/:orderId ──────────────────────────────────────────────────

  describe("PUT /orders/:orderId", () => {
    it("200 — met à jour les notes d'une commande", async () => {
      const res = await api
        .put(`/orders/${createdOrderId}`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ notes: "Livrer avant 18h" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.notes).toBe("Livrer avant 18h");
    });

    it("200 — met à jour l'adresse de livraison", async () => {
      const newAddress = await seedAddress(regularUser.id);

      const res = await api
        .put(`/orders/${createdOrderId}`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          shippingAddressId: newAddress.id,
          shippingAddress,
        });

      expect(res.status).toBe(200);
    });

    it("404 — commande introuvable", async () => {
      const res = await api
        .put("/orders/nonexistent-id")
        .set("Authorization", `Bearer ${userTok}`)
        .send({ notes: "test" });

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api
        .put(`/orders/${createdOrderId}`)
        .send({ notes: "test" });

      expect(res.status).toBe(401);
    });
  });

  // ── PUT /orders/:orderId/status ───────────────────────────────────────────

  describe("PUT /orders/:orderId/status", () => {
    it("200 — change le statut d'une commande (admin)", async () => {
      const res = await api
        .put(`/orders/${createdOrderId}/status`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ status: "CONFIRMED", reason: "Validation admin" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.status).toBe("CONFIRMED");
    });

    it("200 — l'historique de statut est mis à jour", async () => {
      const res = await api
        .get(`/orders/${createdOrderId}`)
        .set("Authorization", `Bearer ${userTok}`);

      const history = res.body.data.statusHistory;
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].toStatus).toBe("CONFIRMED");
    });

    it("400 — rejette un statut invalide", async () => {
      const res = await api
        .put(`/orders/${createdOrderId}/status`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ status: "INVALID_STATUS" });

      expect(res.status).toBe(400);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .put(`/orders/${createdOrderId}/status`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ status: "DELIVERED" });

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api
        .put(`/orders/${createdOrderId}/status`)
        .send({ status: "DELIVERED" });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /user/:userId/orders ──────────────────────────────────────────────

  describe("GET /user/:userId/orders", () => {
    it("200 — retourne les commandes d'un utilisateur (admin)", async () => {
      const res = await api
        .get(`/user/${regularUser.id}/orders`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty("items");
      res.body.data.items.forEach((o: any) => {
        expect(o.userId).toBe(regularUser.id);
      });
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .get(`/user/${regularUser.id}/orders`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get(`/user/${regularUser.id}/orders`);
      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /orders/:orderId ───────────────────────────────────────────────

  describe("DELETE /orders/:orderId", () => {
    it("401 — rejette sans token", async () => {
      const res = await api.delete(`/orders/${createdOrderId}`);
      expect(res.status).toBe(401);
    });

    it("200 — annule une commande", async () => {
      // Créer une commande dédiée à la suppression
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          items: [{ id: String(product2Id), quantity: 1 }],
          shippingAddress,
        });

      const orderId = res.body.data.id;

      const delRes = await api
        .delete(`/orders/${orderId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.data.message).toBe("Order cancelled successfully");
    });

    it("404 — commande introuvable après annulation", async () => {
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          items: [{ id: String(productId), quantity: 1 }],
          shippingAddress,
        });

      const orderId = res.body.data.id;
      await api
        .delete(`/orders/${orderId}`)
        .set("Authorization", `Bearer ${userTok}`);

      const getRes = await api
        .get(`/orders/${orderId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(getRes.status).toBe(404);
    });
  });
});
