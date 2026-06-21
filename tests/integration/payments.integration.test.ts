// tests/integration/payments.integration.test.ts
import { api } from "./setup/app";
import {
  cleanPayments,
  cleanOrders,
  cleanBaskets,
  cleanProducts,
  cleanCategories,
  cleanAddresses,
  cleanUsers,
  seedUser,
  seedCategory,
  seedProduct,
  seedAddress,
} from "./setup/db";
import { adminToken, userToken } from "./setup/auth";
import { prisma } from "../../src/shared/config/database";

const TS = Date.now();

describe("[Integration] Payments", () => {
  let adminUser: Awaited<ReturnType<typeof seedUser>>;
  let regularUser: Awaited<ReturnType<typeof seedUser>>;
  let otherUser: Awaited<ReturnType<typeof seedUser>>;
  let adminTok: string;
  let userTok: string;
  let otherTok: string;
  let categoryId: string;
  let productId: number;
  let addressId: string;
  let orderId: string;
  let order2Id: string;
  let createdPaymentId: string;

  const shippingAddress = {
    street: "1 rue de Test",
    city: "Yaoundé",
    country: "CM",
    postalCode: "0000",
  };

  const createOrder = async (tok: string, pid: number) => {
    const res = await api
      .post("/orders")
      .set("Authorization", `Bearer ${tok}`)
      .send({
        items: [{ id: String(pid), quantity: 1 }],
        shippingAddress,
      });
    return res.body.data.id as string;
  };

  beforeAll(async () => {
    adminUser = await seedUser({
      username: `test_admin_pay_${TS}`,
      email: `test_admin_pay_${TS}@example.com`,
      role: "ADMIN",
    });
    regularUser = await seedUser({
      username: `test_user_pay_${TS}`,
      email: `test_user_pay_${TS}@example.com`,
      role: "USER",
    });
    otherUser = await seedUser({
      username: `test_other_pay_${TS}`,
      email: `test_other_pay_${TS}@example.com`,
      role: "USER",
    });
    adminTok = adminToken(adminUser.id);
    userTok = userToken(regularUser.id);
    otherTok = userToken(otherUser.id);

    const category = await seedCategory({ slug: `test-cat-pay-${TS}` });
    categoryId = category.id;

    const product = await seedProduct(categoryId, {
      sku: `TEST-PAY-P1-${TS}`,
      price: 4000,
    });
    productId = product.id;

    const address = await seedAddress(regularUser.id);
    addressId = address.id;

    orderId = await createOrder(userTok, productId);
    order2Id = await createOrder(userTok, productId);
  });

  afterAll(async () => {
    await cleanPayments();
    await cleanOrders();
    await cleanBaskets();
    await cleanAddresses();
    await cleanProducts();
    await cleanCategories();
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── GET /payment-methods ──────────────────────────────────────────────────

  describe("GET /payment-methods", () => {
    it("200 — retourne les méthodes de paiement sans auth", async () => {
      const res = await api.get("/payment-methods");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const cod = res.body.data.find((m: any) => m.id === "CASH_ON_DELIVERY");
      expect(cod).toBeDefined();
      expect(cod.available).toBe(true);

      const stripe = res.body.data.find((m: any) => m.id === "STRIPE");
      expect(stripe.available).toBe(false);
    });
  });

  // ── POST /payments ────────────────────────────────────────────────────────

  describe("POST /payments", () => {
    it("201 — crée un paiement CASH_ON_DELIVERY et confirme la commande", async () => {
      const res = await api
        .post("/payments")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          order_id: orderId,
          method: "CASH_ON_DELIVERY",
          currency: "XAF",
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.method).toBe("CASH_ON_DELIVERY");
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.amount).toBe(4000);

      createdPaymentId = res.body.data.id;

      // Vérifier que la commande est passée en CONFIRMED
      const orderRes = await api
        .get(`/orders/${orderId}`)
        .set("Authorization", `Bearer ${userTok}`);
      expect(orderRes.body.data.status).toBe("CONFIRMED");
    });

    it("503 — rejette STRIPE (méthode non disponible)", async () => {
      const res = await api
        .post("/payments")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          order_id: order2Id,
          method: "STRIPE",
          currency: "XAF",
        });

      expect(res.status).toBe(503);
      expect(res.body.status).toBe(false);
    });

    it("503 — rejette PAYPAL (méthode non disponible)", async () => {
      const res = await api
        .post("/payments")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          order_id: order2Id,
          method: "PAYPAL",
          currency: "XAF",
        });

      expect(res.status).toBe(503);
    });

    it("503 — rejette CINETPAY (méthode non disponible)", async () => {
      const res = await api
        .post("/payments")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          order_id: order2Id,
          method: "CINETPAY",
          currency: "XAF",
        });

      expect(res.status).toBe(503);
    });

    it("404 — rejette si la commande est introuvable", async () => {
      const res = await api
        .post("/payments")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          order_id: "nonexistent-order-id",
          method: "CASH_ON_DELIVERY",
          currency: "XAF",
        });

      expect(res.status).toBe(404);
    });

    it("403 — rejette si la commande appartient à un autre utilisateur", async () => {
      const res = await api
        .post("/payments")
        .set("Authorization", `Bearer ${otherTok}`)
        .send({
          order_id: order2Id,
          method: "CASH_ON_DELIVERY",
          currency: "XAF",
        });

      expect(res.status).toBe(403);
    });

    it("400 — rejette une méthode invalide", async () => {
      const res = await api
        .post("/payments")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          order_id: order2Id,
          method: "BITCOIN",
          currency: "XAF",
        });

      expect(res.status).toBe(400);
    });

    it("400 — rejette si order_id manquant", async () => {
      const res = await api
        .post("/payments")
        .set("Authorization", `Bearer ${userTok}`)
        .send({ method: "CASH_ON_DELIVERY", currency: "XAF" });

      expect(res.status).toBe(400);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.post("/payments").send({
        order_id: order2Id,
        method: "CASH_ON_DELIVERY",
        currency: "XAF",
      });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /payments/:payment_id ─────────────────────────────────────────────

  describe("GET /payments/:payment_id", () => {
    it("200 — retourne un paiement par ID", async () => {
      const res = await api
        .get(`/payments/${createdPaymentId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(createdPaymentId);
      expect(res.body.data).toHaveProperty("order");
      expect(res.body.data).toHaveProperty("user");
    });

    it("404 — paiement introuvable", async () => {
      const res = await api
        .get("/payments/nonexistent-id")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get(`/payments/${createdPaymentId}`);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /orders/:orderId/payments ─────────────────────────────────────────

  describe("GET /orders/:orderId/payments", () => {
    it("200 — retourne les paiements d'une commande", async () => {
      const res = await api
        .get(`/orders/${orderId}/payments`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].orderId).toBe(orderId);
    });

    it("200 — retourne un tableau vide si aucun paiement", async () => {
      const emptyOrder = await createOrder(userTok, productId);

      const res = await api
        .get(`/orders/${emptyOrder}/payments`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get(`/orders/${orderId}/payments`);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /payments ─────────────────────────────────────────────────────────

  describe("GET /payments", () => {
    it("200 — liste tous les paiements (admin)", async () => {
      const res = await api
        .get("/payments")
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("total");
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it("200 — filtre par status", async () => {
      const res = await api
        .get("/payments?status=PENDING")
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      res.body.data.items.forEach((p: any) => {
        expect(p.status).toBe("PENDING");
      });
    });

    it("200 — filtre par method", async () => {
      const res = await api
        .get("/payments?method=CASH_ON_DELIVERY")
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      res.body.data.items.forEach((p: any) => {
        expect(p.method).toBe("CASH_ON_DELIVERY");
      });
    });

    it("200 — filtre par order_id", async () => {
      const res = await api
        .get(`/payments?order_id=${orderId}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      res.body.data.items.forEach((p: any) => {
        expect(p.orderId).toBe(orderId);
      });
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .get("/payments")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/payments");
      expect(res.status).toBe(401);
    });
  });
});
