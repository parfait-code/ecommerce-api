import { api } from "./setup/app";
import { cleanUsers } from "./setup/db";
import { prisma } from "../../src/shared/config/database";

const TS = Date.now();
const USERNAME = `test_auth_${TS}`;
const EMAIL = `test_auth_${TS}@example.com`;

describe("[Integration] Auth", () => {
  afterAll(async () => {
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── POST /signup ──────────────────────────────────────────────────────────

  describe("POST /signup", () => {
    it("200 — crée un compte et retourne un token", async () => {
      const res = await api.post("/signup").send({
        username: USERNAME,
        email: EMAIL,
        password: "secret123",
        firstName: "Test",
        lastName: "Auth",
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe("string");
      expect(res.body.data.user).not.toHaveProperty("password");
      expect(res.body.data.user.username).toBe(USERNAME);
      expect(res.body.data.user.role).toBe("USER");
    });

    it("409 — rejette si le username est déjà pris", async () => {
      const res = await api.post("/signup").send({
        username: USERNAME,
        email: `other_${TS}@example.com`,
        password: "secret123",
        firstName: "Test",
        lastName: "Auth",
      });

      expect(res.status).toBe(409);
      expect(res.body.status).toBe(false);
      expect(res.body.error.message).toMatch(/username/i);
    });

    it("409 — rejette si l'email est déjà pris", async () => {
      const res = await api.post("/signup").send({
        username: `test_auth_other_${TS}`,
        email: EMAIL,
        password: "secret123",
        firstName: "Test",
        lastName: "Auth",
      });

      expect(res.status).toBe(409);
      expect(res.body.status).toBe(false);
      expect(res.body.error.message).toMatch(/email/i);
    });

    it("400 — rejette si le body est invalide (password trop court)", async () => {
      const res = await api.post("/signup").send({
        username: `test_auth_bad_${TS}`,
        email: `bad_${TS}@example.com`,
        password: "abc",
        firstName: "Test",
        lastName: "Auth",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("400 — rejette si des champs obligatoires sont manquants", async () => {
      const res = await api.post("/signup").send({
        username: `test_auth_missing_${TS}`,
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });
  });

  // ── POST /login ───────────────────────────────────────────────────────────

  describe("POST /login", () => {
    it("200 — connecte avec des credentials valides", async () => {
      const res = await api.post("/login").send({
        username: USERNAME,
        password: "secret123",
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.username).toBe(USERNAME);
    });

    it("400 — rejette un mauvais mot de passe", async () => {
      const res = await api.post("/login").send({
        username: USERNAME,
        password: "wrongpassword",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("400 — rejette un username inexistant", async () => {
      const res = await api.post("/login").send({
        username: `nobody_${TS}`,
        password: "secret123",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });

    it("400 — rejette si le body est vide", async () => {
      const res = await api.post("/login").send({});

      expect(res.status).toBe(400);
      expect(res.body.status).toBe(false);
    });
  });
});
