// tests/integration/promotions.integration.test.ts
import { api } from "./setup/app";
import {
  cleanPromotions,
  cleanCategories,
  cleanProducts,
  cleanUsers,
  seedUser,
  seedCategory,
  seedProduct,
  seedPromotion,
} from "./setup/db";
import { adminToken, userToken } from "./setup/auth";
import { prisma } from "../../src/shared/config/database";

const TS = Date.now();

describe("[Integration] Promotions", () => {
  let adminUser: Awaited<ReturnType<typeof seedUser>>;
  let regularUser: Awaited<ReturnType<typeof seedUser>>;
  let adminTok: string;
  let userTok: string;
  let categoryId: string;
  let productId: number;
  let createdPromotionId: string;
  let createdDiscountId: string;
  let createdCouponId: string;
  let createdCouponCode: string;

  beforeAll(async () => {
    adminUser = await seedUser({
      username: `test_admin_promo_${TS}`,
      email: `test_admin_promo_${TS}@example.com`,
      role: "ADMIN",
    });
    regularUser = await seedUser({
      username: `test_user_promo_${TS}`,
      email: `test_user_promo_${TS}@example.com`,
      role: "USER",
    });
    adminTok = adminToken(adminUser.id);
    userTok = userToken(regularUser.id);

    const category = await seedCategory({ slug: `test-cat-promo-${TS}` });
    categoryId = category.id;

    const product = await seedProduct(categoryId, {
      sku: `TEST-PROMO-PROD-${TS}`,
    });
    productId = product.id;
  });

  afterAll(async () => {
    await cleanPromotions();
    await cleanProducts();
    await cleanCategories();
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── POST /promotions ──────────────────────────────────────────────────────

  describe("POST /promotions", () => {
    it("201 — crée une promotion (admin)", async () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const res = await api
        .post("/promotions")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          name: `Test Promotion ${TS}`,
          slug: `test-promo-${TS}`,
          description: "Une promotion de test",
          startDate: start,
          endDate: end,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.slug).toBe(`test-promo-${TS}`);
      expect(res.body.data.isActive).toBe(true);

      createdPromotionId = res.body.data.id;
    });

    it("409 — rejette un slug déjà pris", async () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 86400000).toISOString();

      const res = await api
        .post("/promotions")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          name: `Test Promotion Dup ${TS}`,
          slug: `test-promo-${TS}`,
          startDate: start,
          endDate: end,
        });

      expect(res.status).toBe(409);
    });

    it("400 — rejette si endDate <= startDate", async () => {
      const now = new Date().toISOString();

      const res = await api
        .post("/promotions")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          name: `Test Promotion Bad Date ${TS}`,
          slug: `test-promo-baddate-${TS}`,
          startDate: now,
          endDate: now,
        });

      expect(res.status).toBe(400);
    });

    it("400 — rejette si slug invalide (majuscules)", async () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 86400000).toISOString();

      const res = await api
        .post("/promotions")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          name: `Test Promo Bad Slug ${TS}`,
          slug: `Test-Promo-Bad-${TS}`,
          startDate: start,
          endDate: end,
        });

      expect(res.status).toBe(400);
    });

    it("403 — refusé pour un non admin", async () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 86400000).toISOString();

      const res = await api
        .post("/promotions")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          name: `Test Promo Forbidden ${TS}`,
          slug: `test-promo-forbidden-${TS}`,
          startDate: start,
          endDate: end,
        });

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 86400000).toISOString();

      const res = await api.post("/promotions").send({
        name: `Test Promo Unauth ${TS}`,
        slug: `test-promo-unauth-${TS}`,
        startDate: start,
        endDate: end,
      });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /promotions/slug/:slug ────────────────────────────────────────────

  describe("GET /promotions/slug/:slug", () => {
    it("200 — retourne une promotion par slug sans auth", async () => {
      const res = await api.get(`/promotions/slug/test-promo-${TS}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.slug).toBe(`test-promo-${TS}`);
      expect(res.body.data).toHaveProperty("discounts");
      expect(res.body.data).toHaveProperty("coupons");
    });

    it("404 — slug introuvable", async () => {
      const res = await api.get("/promotions/slug/slug-inexistant-99999");

      expect(res.status).toBe(404);
    });
  });

  // ── GET /promotions ───────────────────────────────────────────────────────

  describe("GET /promotions", () => {
    it("200 — liste toutes les promotions (admin)", async () => {
      const res = await api
        .get("/promotions")
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("200 — filtre par status", async () => {
      const res = await api
        .get("/promotions?status=ACTIVE")
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .get("/promotions")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/promotions");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /promotions/:promotionId ──────────────────────────────────────────

  describe("GET /promotions/:promotionId", () => {
    it("200 — retourne une promotion par ID (admin)", async () => {
      const res = await api
        .get(`/promotions/${createdPromotionId}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdPromotionId);
    });

    it("404 — promotion introuvable", async () => {
      const res = await api
        .get("/promotions/nonexistent-id")
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(404);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .get(`/promotions/${createdPromotionId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });
  });

  // ── PUT /promotions/:promotionId ──────────────────────────────────────────

  describe("PUT /promotions/:promotionId", () => {
    it("200 — met à jour une promotion (admin)", async () => {
      const res = await api
        .put(`/promotions/${createdPromotionId}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ description: "Description mise à jour" });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe("Description mise à jour");
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .put(`/promotions/${createdPromotionId}`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ description: "Hacked" });

      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /promotions/:promotionId/toggle ─────────────────────────────────

  describe("PATCH /promotions/:promotionId/toggle", () => {
    it("200 — bascule isActive (admin)", async () => {
      const before = await api
        .get(`/promotions/${createdPromotionId}`)
        .set("Authorization", `Bearer ${adminTok}`);
      const wasActive = before.body.data.isActive;

      const res = await api
        .patch(`/promotions/${createdPromotionId}/toggle`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(!wasActive);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .patch(`/promotions/${createdPromotionId}/toggle`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /promotions/:promotionId/discounts ───────────────────────────────

  describe("POST /promotions/:promotionId/discounts", () => {
    it("201 — crée une remise sur catégorie (admin)", async () => {
      const res = await api
        .post(`/promotions/${createdPromotionId}/discounts`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          type: "PERCENTAGE",
          value: 20,
          categoryId,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.type).toBe("PERCENTAGE");
      expect(res.body.data.value).toBe(20);

      createdDiscountId = res.body.data.id;
    });

    it("201 — crée une remise sur produits", async () => {
      const res = await api
        .post(`/promotions/${createdPromotionId}/discounts`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          type: "FIXED_AMOUNT",
          value: 500,
          productIds: [productId],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe("FIXED_AMOUNT");
    });

    it("400 — rejette si ni categoryId ni productIds", async () => {
      const res = await api
        .post(`/promotions/${createdPromotionId}/discounts`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ type: "PERCENTAGE", value: 10 });

      expect(res.status).toBe(400);
    });

    it("400 — rejette si PERCENTAGE > 100", async () => {
      const res = await api
        .post(`/promotions/${createdPromotionId}/discounts`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ type: "PERCENTAGE", value: 150, categoryId });

      expect(res.status).toBe(400);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .post(`/promotions/${createdPromotionId}/discounts`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ type: "PERCENTAGE", value: 10, categoryId });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /promotions/:promotionId/discounts/:discountId ─────────────────

  describe("DELETE /promotions/:promotionId/discounts/:discountId", () => {
    it("200 — supprime une remise (admin)", async () => {
      const res = await api
        .delete(
          `/promotions/${createdPromotionId}/discounts/${createdDiscountId}`,
        )
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe("Discount deleted successfully");
    });

    it("404 — remise introuvable", async () => {
      const res = await api
        .delete(`/promotions/${createdPromotionId}/discounts/nonexistent-id`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(404);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .delete(
          `/promotions/${createdPromotionId}/discounts/${createdDiscountId}`,
        )
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /promotions/:promotionId/coupons ─────────────────────────────────

  describe("POST /promotions/:promotionId/coupons", () => {
    it("201 — crée un coupon (admin)", async () => {
      createdCouponCode = `TESTCOUPON${TS}`.slice(0, 20).toUpperCase();

      const res = await api
        .post(`/promotions/${createdPromotionId}/coupons`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          code: createdCouponCode,
          maxUses: 100,
          perUserLimit: 1,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.code).toBe(createdCouponCode);

      createdCouponId = res.body.data.id;
    });

    it("400 — rejette un code trop court", async () => {
      const res = await api
        .post(`/promotions/${createdPromotionId}/coupons`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ code: "AB", maxUses: 10, perUserLimit: 1, isActive: true });

      expect(res.status).toBe(400);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .post(`/promotions/${createdPromotionId}/coupons`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          code: "FORBIDDEN123",
          maxUses: 10,
          perUserLimit: 1,
          isActive: true,
        });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /promotions/:promotionId/coupons ──────────────────────────────────

  describe("GET /promotions/:promotionId/coupons", () => {
    it("200 — liste les coupons d'une promotion (admin)", async () => {
      const res = await api
        .get(`/promotions/${createdPromotionId}/coupons`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .get(`/promotions/${createdPromotionId}/coupons`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /coupons/validate ────────────────────────────────────────────────

  describe("POST /coupons/validate", () => {
    let basketId: string;

    beforeAll(async () => {
      const res = await api
        .post("/basket")
        .set("Authorization", `Bearer ${userTok}`);
      basketId = res.body.data.id;
    });

    it("200 — valide un coupon actif", async () => {
      // S'assurer que la promo est active
      await api
        .patch(`/promotions/${createdPromotionId}/toggle`)
        .set("Authorization", `Bearer ${adminTok}`);
      const promoRes = await api
        .get(`/promotions/${createdPromotionId}`)
        .set("Authorization", `Bearer ${adminTok}`);
      if (!promoRes.body.data.isActive) {
        await api
          .patch(`/promotions/${createdPromotionId}/toggle`)
          .set("Authorization", `Bearer ${adminTok}`);
      }

      const res = await api
        .post("/coupons/validate")
        .set("Authorization", `Bearer ${userTok}`)
        .send({ code: createdCouponCode, basketId });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.code).toBe(createdCouponCode);
      expect(res.body.data).toHaveProperty("promotion");
    });

    it("404 — rejette un code inexistant", async () => {
      const res = await api
        .post("/coupons/validate")
        .set("Authorization", `Bearer ${userTok}`)
        .send({ code: "INVALID_CODE_XXXX", basketId });

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api
        .post("/coupons/validate")
        .send({ code: createdCouponCode, basketId });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /promotions/:promotionId/coupons/:couponId ─────────────────────

  describe("DELETE /promotions/:promotionId/coupons/:couponId", () => {
    it("200 — supprime un coupon (admin)", async () => {
      const res = await api
        .delete(`/promotions/${createdPromotionId}/coupons/${createdCouponId}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe("Coupon deleted successfully");
    });

    it("404 — coupon introuvable", async () => {
      const res = await api
        .delete(`/promotions/${createdPromotionId}/coupons/nonexistent-id`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /promotions/:promotionId ───────────────────────────────────────

  describe("DELETE /promotions/:promotionId", () => {
    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .delete(`/promotions/${createdPromotionId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });

    it("200 — supprime une promotion (admin)", async () => {
      const promo = await seedPromotion({
        slug: `test-promo-to-delete-${TS}`,
      });

      const res = await api
        .delete(`/promotions/${promo.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe("Promotion deleted successfully");
    });

    it("404 — promotion introuvable après suppression", async () => {
      const promo = await seedPromotion({
        slug: `test-promo-deleted-check-${TS}`,
      });
      await api
        .delete(`/promotions/${promo.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      const res = await api
        .get(`/promotions/${promo.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(404);
    });
  });
});
