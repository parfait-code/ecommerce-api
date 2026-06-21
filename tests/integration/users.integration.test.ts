import { api } from "./setup/app";
import { cleanUsers, seedUser } from "./setup/db";
import { adminToken, userToken } from "./setup/auth";
import { prisma } from "../../src/shared/config/database";

const TS = Date.now();

describe("[Integration] Users", () => {
  let adminUser: Awaited<ReturnType<typeof seedUser>>;
  let regularUser: Awaited<ReturnType<typeof seedUser>>;
  let adminTok: string;
  let userTok: string;

  beforeAll(async () => {
    adminUser = await seedUser({
      username: `test_admin_${TS}`,
      email: `test_admin_${TS}@example.com`,
      role: "ADMIN",
    });
    regularUser = await seedUser({
      username: `test_user_${TS}`,
      email: `test_user_${TS}@example.com`,
      role: "USER",
    });
    adminTok = adminToken(adminUser.id);
    userTok = userToken(regularUser.id);
  });

  afterAll(async () => {
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── GET /user ─────────────────────────────────────────────────────────────

  describe("GET /user", () => {
    it("200 — retourne son propre profil", async () => {
      const res = await api
        .get("/user")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(regularUser.id);
      expect(res.body.data.username).toBe(regularUser.username);
      expect(res.body.data).not.toHaveProperty("password");
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/user");
      expect(res.status).toBe(401);
      expect(res.body.status).toBe(false);
    });
  });

  // ── PATCH /user ───────────────────────────────────────────────────────────

  describe("PATCH /user", () => {
    it("200 — met à jour son propre profil", async () => {
      const res = await api
        .patch("/user")
        .set("Authorization", `Bearer ${userTok}`)
        .send({ firstName: "Updated" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.firstName).toBe("Updated");
      expect(res.body.data).not.toHaveProperty("password");
    });

    it("400 — rejette un email invalide", async () => {
      const res = await api
        .patch("/user")
        .set("Authorization", `Bearer ${userTok}`)
        .send({ email: "not-an-email" });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.patch("/user").send({ firstName: "X" });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /user/all ─────────────────────────────────────────────────────────

  describe("GET /user/all", () => {
    it("200 — retourne la liste des utilisateurs (admin)", async () => {
      const res = await api
        .get("/user/all")
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((u: any) => {
        expect(u).not.toHaveProperty("password");
      });
    });

    it("403 — refusé pour un utilisateur non admin", async () => {
      const res = await api
        .get("/user/all")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe(false);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/user/all");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /user/:userId ─────────────────────────────────────────────────────

  describe("GET /user/:userId", () => {
    it("200 — retourne un utilisateur par ID (admin)", async () => {
      const res = await api
        .get(`/user/${regularUser.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(regularUser.id);
      expect(res.body.data).not.toHaveProperty("password");
    });

    it("404 — utilisateur introuvable", async () => {
      const res = await api
        .get("/user/999999")
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe(false);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .get(`/user/${adminUser.id}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /user (admin create) ─────────────────────────────────────────────

  describe("POST /user", () => {
    it("201 — crée un utilisateur (admin)", async () => {
      const res = await api
        .post("/user")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          username: `test_created_${TS}`,
          email: `test_created_${TS}@example.com`,
          password: "secret123",
          firstName: "Created",
          lastName: "ByAdmin",
          role: "USER",
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data).not.toHaveProperty("password");
      expect(res.body.data.username).toBe(`test_created_${TS}`);
    });

    it("409 — rejette un username déjà pris", async () => {
      const res = await api
        .post("/user")
        .set("Authorization", `Bearer ${adminTok}`)
        .send({
          username: regularUser.username,
          email: `unique_${TS}@example.com`,
          password: "secret123",
          firstName: "X",
          lastName: "Y",
          role: "USER",
        });

      expect(res.status).toBe(409);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .post("/user")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          username: `test_noadmin_${TS}`,
          email: `test_noadmin_${TS}@example.com`,
          password: "secret123",
          firstName: "X",
          lastName: "Y",
          role: "USER",
        });

      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /user/change-role/:userId ───────────────────────────────────────

  describe("PATCH /user/change-role/:userId", () => {
    it("200 — change le rôle d'un utilisateur (admin)", async () => {
      const res = await api
        .patch(`/user/change-role/${regularUser.id}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ role: "MANAGER" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data).not.toHaveProperty("password");
    });

    it("400 — rejette un rôle invalide", async () => {
      const res = await api
        .patch(`/user/change-role/${regularUser.id}`)
        .set("Authorization", `Bearer ${adminTok}`)
        .send({ role: "SUPERUSER" });

      expect(res.status).toBe(400);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .patch(`/user/change-role/${adminUser.id}`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ role: "ADMIN" });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /user/:userId ──────────────────────────────────────────────────

  describe("DELETE /user/:userId", () => {
    it("200 — supprime (soft delete) un utilisateur (admin)", async () => {
      const target = await seedUser({
        username: `test_to_delete_${TS}`,
        email: `test_to_delete_${TS}@example.com`,
      });

      const res = await api
        .delete(`/user/${target.id}`)
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.numberOfUsersDeleted).toBe(1);
    });

    it("404 — utilisateur introuvable", async () => {
      const res = await api
        .delete("/user/999999")
        .set("Authorization", `Bearer ${adminTok}`);

      expect(res.status).toBe(404);
    });

    it("403 — refusé pour un non admin", async () => {
      const res = await api
        .delete(`/user/${adminUser.id}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(403);
    });
  });
});
