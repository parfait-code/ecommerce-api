// tests/integration/inventory.integration.test.ts
import { api } from "./setup/app";
import {
  cleanInventory,
  cleanProducts,
  cleanCategories,
  cleanWarehouses,
  cleanUsers,
  seedUser,
  seedCategory,
  seedProduct,
  seedWarehouse,
} from "./setup/db";
import { adminToken, userToken } from "./setup/auth";
import { prisma } from "../../src/shared/config/database";

const TS = Date.now();

describe("[Integration] Inventory", () => {
  let adminUser: Awaited<ReturnType<typeof seedUser>>;
  let regularUser: Awaited<ReturnType<typeof seedUser>>;
  let adminTok: string;
  let userTok: string;
  let categoryId: string;
  let productId: number;
  let warehouseId: string;
  let warehouse2Id: string;
  let createdItemId: string;

  beforeAll(async () => {
    adminUser = await seedUser({
      username: `test_admin_inv_${TS}`,
      email: `test_admin_inv_${TS}@example.com`,
      role: "ADMIN",
    });
    regularUser = await seedUser({
      username: `test_user_inv_${TS}`,
      email: `test_user_inv_${TS}@example.com`,
      role: "USER",
    });
    adminTok = adminToken(adminUser.id);
    userTok = userToken(regularUser.id);

    const category = await seedCategory({ slug: `test-cat-inv-${TS}` });
    categoryId = category.id;

    const product = await seedProduct(categoryId, {
      sku: `TEST-INV-PROD-${TS}`,
      name: `Test Inventory Product ${TS}`,
    });
    productId = product.id;

    const warehouse = await seedWarehouse({
      name: `Test Warehouse Inv ${TS}`,
      location: "Douala",
    });
    warehouseId = warehouse.id;

    const warehouse2 = await seedWarehouse({
      name: `Test Warehouse Inv2 ${TS}`,
      location: "Yaoundé",
    });
    warehouse2Id = warehouse2.id;
  });

  afterAll(async () => {
    await cleanInventory();
    await cleanProducts();
    await cleanCategories();
    await cleanWarehouses();
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── GET /inventory ────────────────────────────────────────────────────────

  describe("GET /inventory", () => {
    it("200 — retourne l'inventaire paginé", async () => {
      const res = await api
        .get("/inventory")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("total");
      expect(res.body.data).toHaveProperty("page");
      expect(res.body.data).toHaveProperty("limit");
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/inventory");
      expect(res.status).toBe(401);
    });
  });

  // ── POST /inventory ───────────────────────────────────────────────────────

  describe("POST /inventory", () => {
    it("201 — crée un article d'inventaire (admin)", async () => {
      const res = await api
        .post("/inventory")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.quantity).toBe(50);
      expect(res.body.data.product).toBeDefined();
      expect(res.body.data.warehouse).toBeDefined();

      createdItemId = res.body.data.id;
    });

    it("409 — rejette si doublon produit/entrepôt", async () => {
      const res = await api
        .post("/inventory")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: 10,
        });

      expect(res.status).toBe(409);
      expect(res.body.status).toBe(false);
    });

    it("404 — rejette si produit introuvable", async () => {
      const res = await api
        .post("/inventory")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          product_id: 999999,
          warehouse_id: warehouseId,
          quantity: 10,
        });

      expect(res.status).toBe(404);
    });

    it("404 — rejette si entrepôt introuvable", async () => {
      const res = await api
        .post("/inventory")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          product_id: productId,
          warehouse_id: "nonexistent-wh",
          quantity: 10,
        });

      expect(res.status).toBe(404);
    });

    it("400 — rejette si quantity négative", async () => {
      const res = await api
        .post("/inventory")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          product_id: productId,
          warehouse_id: warehouse2Id,
          quantity: -5,
        });

      expect(res.status).toBe(400);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .post("/inventory")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          product_id: productId,
          warehouse_id: warehouse2Id,
          quantity: 10,
        });

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.post("/inventory").send({
        product_id: productId,
        warehouse_id: warehouse2Id,
        quantity: 10,
      });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /inventory/:item_id ───────────────────────────────────────────────

  describe("GET /inventory/:item_id", () => {
    it("200 — retourne un article par ID", async () => {
      const res = await api
        .get(`/inventory/${createdItemId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(createdItemId);
      expect(res.body.data.quantity).toBe(50);
    });

    it("404 — article introuvable", async () => {
      const res = await api
        .get("/inventory/nonexistent-id")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get(`/inventory/${createdItemId}`);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /inventory/low-stock ──────────────────────────────────────────────

  describe("GET /inventory/low-stock", () => {
    it("200 — retourne les articles en stock faible", async () => {
      const res = await api
        .get("/inventory/low-stock")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("200 — accepte un threshold personnalisé", async () => {
      const res = await api
        .get("/inventory/low-stock?threshold=100")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/inventory/low-stock");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /inventory/out-of-stock ───────────────────────────────────────────

  describe("GET /inventory/out-of-stock", () => {
    it("200 — retourne les articles en rupture", async () => {
      const res = await api
        .get("/inventory/out-of-stock")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/inventory/out-of-stock");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /inventory/search ─────────────────────────────────────────────────

  describe("GET /inventory/search", () => {
    it("200 — retourne les résultats correspondant au keyword", async () => {
      const res = await api
        .get("/inventory/search?keyword=Inventory")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("500 — rejette si keyword absent", async () => {
      const res = await api
        .get("/inventory/search")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/inventory/search?keyword=test");
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /inventory/:item_id ───────────────────────────────────────────────

  describe("PUT /inventory/:item_id", () => {
    it("200 — met à jour la quantité (admin)", async () => {
      const res = await api
        .put(`/inventory/${createdItemId}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ quantity: 80 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.quantity).toBe(80);
    });

    it("404 — article introuvable", async () => {
      const res = await api
        .put("/inventory/nonexistent-id")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ quantity: 10 });

      expect(res.status).toBe(404);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .put(`/inventory/${createdItemId}`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ quantity: 10 });

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api
        .put(`/inventory/${createdItemId}`)
        .send({ quantity: 10 });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /inventory/transfer ──────────────────────────────────────────────

  describe("POST /inventory/transfer", () => {
    it("200 — transfère du stock entre entrepôts (admin)", async () => {
      // D'abord créer l'inventaire dans warehouse2 pour la destination
      const res = await api
        .post("/inventory/transfer")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          item_id: createdItemId,
          from_warehouse: warehouseId,
          to_warehouse: warehouse2Id,
          quantity: 20,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.quantity).toBe(20);
      expect(res.body.data.from_warehouse).toBe(warehouseId);
      expect(res.body.data.to_warehouse).toBe(warehouse2Id);
    });

    it("400 — rejette si stock source insuffisant", async () => {
      const res = await api
        .post("/inventory/transfer")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          item_id: createdItemId,
          from_warehouse: warehouseId,
          to_warehouse: warehouse2Id,
          quantity: 99999,
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("400 — rejette si quantity = 0", async () => {
      const res = await api
        .post("/inventory/transfer")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          item_id: createdItemId,
          from_warehouse: warehouseId,
          to_warehouse: warehouse2Id,
          quantity: 0,
        });

      expect(res.status).toBe(400);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .post("/inventory/transfer")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          item_id: createdItemId,
          from_warehouse: warehouseId,
          to_warehouse: warehouse2Id,
          quantity: 5,
        });

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.post("/inventory/transfer").send({
        item_id: createdItemId,
        from_warehouse: warehouseId,
        to_warehouse: warehouse2Id,
        quantity: 5,
      });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /inventory/:item_id ────────────────────────────────────────────

  describe("DELETE /inventory/:item_id", () => {
    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .delete(`/inventory/${createdItemId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.delete(`/inventory/${createdItemId}`);
      expect(res.status).toBe(401);
    });

    it("200 — supprime un article d'inventaire (admin)", async () => {
      // Créer un article dédié à la suppression
      const extraProduct = await seedProduct(categoryId, {
        sku: `TEST-INV-DEL-${TS}`,
      });
      const extraWh = await seedWarehouse({
        name: `Test Warehouse Del ${TS}`,
      });
      const created = await api
        .post("/inventory")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          product_id: extraProduct.id,
          warehouse_id: extraWh.id,
          quantity: 5,
        });

      const itemId = created.body.data.id;

      const res = await api
        .delete(`/inventory/${itemId}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.message).toBe("Inventory item deleted successfully");
    });

    it("404 — article introuvable après suppression", async () => {
      const extraProduct = await seedProduct(categoryId, {
        sku: `TEST-INV-DEL2-${TS}`,
      });
      const extraWh = await seedWarehouse({
        name: `Test Warehouse Del2 ${TS}`,
      });
      const created = await api
        .post("/inventory")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          product_id: extraProduct.id,
          warehouse_id: extraWh.id,
          quantity: 5,
        });

      const itemId = created.body.data.id;
      await api
        .delete(`/inventory/${itemId}`)
        .set("Authorization", `Bearer ${adminTok}`);

      const res = await api
        .get(`/inventory/${itemId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
    });
  });
});
