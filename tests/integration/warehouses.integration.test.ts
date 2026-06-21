// tests/integration/warehouses.integration.test.ts
import { api } from "./setup/app";
import {
  cleanWarehouses,
  cleanUsers,
  seedUser,
  seedWarehouse,
} from "./setup/db";
import { adminToken, userToken } from "./setup/auth";
import { prisma } from "../../src/shared/config/database";

const TS = Date.now();

describe("[Integration] Warehouses", () => {
  let adminUser: Awaited<ReturnType<typeof seedUser>>;
  let regularUser: Awaited<ReturnType<typeof seedUser>>;
  let adminTok: string;
  let userTok: string;
  let createdWarehouseId: string;

  beforeAll(async () => {
    adminUser = await seedUser({
      username: `test_admin_wh_${TS}`,
      email: `test_admin_wh_${TS}@example.com`,
      role: "ADMIN",
    });
    regularUser = await seedUser({
      username: `test_user_wh_${TS}`,
      email: `test_user_wh_${TS}@example.com`,
      role: "USER",
    });
    adminTok = adminToken(adminUser.id);
    userTok = userToken(regularUser.id);
  });

  afterAll(async () => {
    await cleanWarehouses();
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── POST /warehouses ──────────────────────────────────────────────────────

  describe("POST /warehouses", () => {
    it("201 — crée un entrepôt (admin)", async () => {
      const res = await api
        .post("/warehouses")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          name: `Test Warehouse ${TS}`,
          location: "Douala",
          capacity: 500,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.name).toBe(`Test Warehouse ${TS}`);
      expect(res.body.data.location).toBe("Douala");
      expect(res.body.data.capacity).toBe(500);

      createdWarehouseId = res.body.data.id;
    });

    it("201 — crée un entrepôt sans capacité (optionnel)", async () => {
      const res = await api
        .post("/warehouses")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          name: `Test Warehouse No Cap ${TS}`,
          location: "Yaoundé",
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.capacity).toBeNull();
    });

    it("400 — rejette si name manquant", async () => {
      const res = await api
        .post("/warehouses")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ location: "Bafoussam" });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("400 — rejette si location manquant", async () => {
      const res = await api
        .post("/warehouses")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ name: `Test Warehouse No Loc ${TS}` });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .post("/warehouses")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          name: `Test Warehouse Forbidden ${TS}`,
          location: "Douala",
        });

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.post("/warehouses").send({
        name: `Test Warehouse Unauth ${TS}`,
        location: "Douala",
      });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /warehouses ───────────────────────────────────────────────────────

  describe("GET /warehouses", () => {
    it("200 — retourne la liste des entrepôts", async () => {
      const res = await api
        .get("/warehouses")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/warehouses");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /warehouses/:warehouse_id ─────────────────────────────────────────

  describe("GET /warehouses/:warehouse_id", () => {
    it("200 — retourne un entrepôt par ID", async () => {
      const res = await api
        .get(`/warehouses/${createdWarehouseId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(createdWarehouseId);
    });

    it("404 — entrepôt introuvable", async () => {
      const res = await api
        .get("/warehouses/nonexistent-id")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe(false);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get(`/warehouses/${createdWarehouseId}`);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /warehouses/:warehouse_id/inventory ───────────────────────────────

  describe("GET /warehouses/:warehouse_id/inventory", () => {
    it("200 — retourne l'inventaire de l'entrepôt", async () => {
      const res = await api
        .get(`/warehouses/${createdWarehouseId}/inventory`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty("warehouse");
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data.warehouse.id).toBe(createdWarehouseId);
      expect(res.body.data.warehouse).toHaveProperty("totalUnits");
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it("404 — entrepôt introuvable", async () => {
      const res = await api
        .get("/warehouses/nonexistent-id/inventory")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get(`/warehouses/${createdWarehouseId}/inventory`);
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /warehouses/:warehouse_id ─────────────────────────────────────────

  describe("PUT /warehouses/:warehouse_id", () => {
    it("200 — met à jour un entrepôt (admin)", async () => {
      const res = await api
        .put(`/warehouses/${createdWarehouseId}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ location: "Bafoussam", capacity: 800 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.location).toBe("Bafoussam");
      expect(res.body.data.capacity).toBe(800);
    });

    it("200 — mise à jour partielle (un seul champ)", async () => {
      const res = await api
        .put(`/warehouses/${createdWarehouseId}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ capacity: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.data.capacity).toBe(1000);
    });

    it("404 — entrepôt introuvable", async () => {
      const res = await api
        .put("/warehouses/nonexistent-id")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ location: "Anywhere" });

      expect(res.status).toBe(404);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .put(`/warehouses/${createdWarehouseId}`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ location: "Hacked" });

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api
        .put(`/warehouses/${createdWarehouseId}`)
        .send({ location: "Hacked" });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /warehouses/:warehouse_id ──────────────────────────────────────

  describe("DELETE /warehouses/:warehouse_id", () => {
    it("200 — supprime un entrepôt (admin)", async () => {
      const wh = await seedWarehouse({
        name: `Test Warehouse To Delete ${TS}`,
      });

      const res = await api
        .delete(`/warehouses/${wh.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.message).toBe("Warehouse deleted successfully");
    });

    it("404 — entrepôt introuvable après suppression", async () => {
      const wh = await seedWarehouse({
        name: `Test Warehouse Deleted Check ${TS}`,
      });
      await api
        .delete(`/warehouses/${wh.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      const res = await api
        .get(`/warehouses/${wh.id}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .delete(`/warehouses/${createdWarehouseId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.delete(`/warehouses/${createdWarehouseId}`);
      expect(res.status).toBe(401);
    });
  });
});
