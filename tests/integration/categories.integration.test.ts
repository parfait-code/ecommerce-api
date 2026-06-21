import { api } from "./setup/app";
import {
  cleanCategories,
  cleanUsers,
  seedUser,
  seedCategory,
} from "./setup/db";
import { adminToken, userToken } from "./setup/auth";
import { prisma } from "../../src/shared/config/database";

const TS = Date.now();

describe("[Integration] Categories", () => {
  let adminUser: Awaited<ReturnType<typeof seedUser>>;
  let regularUser: Awaited<ReturnType<typeof seedUser>>;
  let adminTok: string;
  let userTok: string;
  let createdCategoryId: string;

  beforeAll(async () => {
    adminUser = await seedUser({
      username: `test_admin_cat_${TS}`,
      email: `test_admin_cat_${TS}@example.com`,
      role: "ADMIN",
    });
    regularUser = await seedUser({
      username: `test_user_cat_${TS}`,
      email: `test_user_cat_${TS}@example.com`,
      role: "USER",
    });
    adminTok = adminToken(adminUser.id);
    userTok = userToken(regularUser.id);
  });

  afterAll(async () => {
    await cleanCategories();
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── POST /categories ──────────────────────────────────────────────────────

  describe("POST /categories", () => {
    it("201 — crée une catégorie (admin)", async () => {
      const res = await api
        .post("/categories")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          name: `Test Category ${TS}`,
          slug: `test-cat-${TS}`,
          description: "Une catégorie de test",
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.slug).toBe(`test-cat-${TS}`);
      expect(res.body.data.parent).toBeNull();
      expect(res.body.data.children).toEqual([]);

      createdCategoryId = res.body.data.id;
    });

    it("409 — rejette un slug déjà pris", async () => {
      const res = await api
        .post("/categories")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          name: `Test Category Other ${TS}`,
          slug: `test-cat-${TS}`,
        });

      expect(res.status).toBe(409);
      expect(res.body.status).toBe(false);
    });

    it("400 — rejette un slug invalide (majuscules)", async () => {
      const res = await api
        .post("/categories")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          name: `Test Category Bad ${TS}`,
          slug: `Test-Cat-Bad-${TS}`,
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .post("/categories")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          name: `Test Category Forbidden ${TS}`,
          slug: `test-cat-forbidden-${TS}`,
        });

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.post("/categories").send({
        name: `Test Category Unauth ${TS}`,
        slug: `test-cat-unauth-${TS}`,
      });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /categories ───────────────────────────────────────────────────────

  describe("GET /categories", () => {
    it("200 — retourne la liste des catégories", async () => {
      const res = await api
        .get("/categories")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/categories");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /categories/:categoryId ───────────────────────────────────────────

  describe("GET /categories/:categoryId", () => {
    it("200 — retourne une catégorie par ID", async () => {
      const res = await api
        .get(`/categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(createdCategoryId);
    });

    it("404 — catégorie introuvable", async () => {
      const res = await api
        .get("/categories/nonexistent-id")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe(false);
    });
  });

  // ── GET /categories/slug/:slug ────────────────────────────────────────────

  describe("GET /categories/slug/:slug", () => {
    it("200 — retourne une catégorie par slug", async () => {
      const res = await api.get(`/categories/slug/test-cat-${TS}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.slug).toBe(`test-cat-${TS}`);
    });

    it("404 — slug introuvable", async () => {
      const res = await api.get("/categories/slug/slug-inexistant-99999");

      expect(res.status).toBe(404);
      expect(res.body.status).toBe(false);
    });
  });

  // ── PUT /categories/:categoryId ───────────────────────────────────────────

  describe("PUT /categories/:categoryId", () => {
    it("200 — met à jour une catégorie (admin)", async () => {
      const res = await api
        .put(`/categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ description: "Description mise à jour" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.description).toBe("Description mise à jour");
    });

    it("400 — rejette si la catégorie tente d'être son propre parent", async () => {
      const res = await api
        .put(`/categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ parentId: createdCategoryId });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .put(`/categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ description: "X" });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /categories/:categoryId ────────────────────────────────────────

  describe("DELETE /categories/:categoryId", () => {
    it("400 — rejette si des produits sont rattachés", async () => {
      // On crée une catégorie avec un produit attaché
      const cat = await seedCategory({ slug: `test-cat-with-products-${TS}` });
      await prisma.product.create({
        data: {
          sku: `TEST-CAT-PROD-${TS}`,
          name: "Test Product For Category",
          price: 1000,
          categoryId: cat.id,
          status: "ACTIVE",
        },
      });

      const res = await api
        .delete(`/categories/${cat.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);

      // Cleanup manuel
      await prisma.product.deleteMany({ where: { categoryId: cat.id } });
      await prisma.category.delete({ where: { id: cat.id } });
    });

    it("200 — supprime une catégorie vide (admin)", async () => {
      const cat = await seedCategory({ slug: `test-cat-to-delete-${TS}` });

      const res = await api
        .delete(`/categories/${cat.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.message).toBe("Category deleted successfully");
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .delete(`/categories/${createdCategoryId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });
  });
});
