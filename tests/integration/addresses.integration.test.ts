// tests/integration/addresses.integration.test.ts
import { api } from "./setup/app";
import { cleanAddresses, cleanUsers, seedUser, seedAddress } from "./setup/db";
import { userToken } from "./setup/auth";
import { prisma } from "../../src/shared/config/database";

const TS = Date.now();

describe("[Integration] Addresses", () => {
  let regularUser: Awaited<ReturnType<typeof seedUser>>;
  let otherUser: Awaited<ReturnType<typeof seedUser>>;
  let userTok: string;
  let otherTok: string;
  let createdAddressId: string;

  beforeAll(async () => {
    regularUser = await seedUser({
      username: `test_user_addr_${TS}`,
      email: `test_user_addr_${TS}@example.com`,
    });
    otherUser = await seedUser({
      username: `test_other_addr_${TS}`,
      email: `test_other_addr_${TS}@example.com`,
    });
    userTok = userToken(regularUser.id);
    otherTok = userToken(otherUser.id);
  });

  afterAll(async () => {
    await cleanAddresses();
    await cleanUsers();
    await prisma.$disconnect();
  });

  // ── POST /address/validate ────────────────────────────────────────────────

  describe("POST /address/validate", () => {
    it("200 — valide une adresse correcte sans auth", async () => {
      const res = await api.post("/address/validate").send({
        street: "1 rue de la Paix",
        city: "Douala",
        country: "CM",
        postal_code: "1234",
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.normalized_address).not.toBeNull();
      expect(res.body.data.normalized_address.country).toBe("CM");
    });

    it("200 — retourne valid:false pour un pays non supporté", async () => {
      const res = await api.post("/address/validate").send({
        street: "1 rue Test",
        city: "Tokyo",
        country: "JP",
        postal_code: "1234",
      });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.normalized_address).toBeNull();
    });

    it("400 — rejette si street manquante", async () => {
      const res = await api.post("/address/validate").send({
        city: "Douala",
        country: "CM",
        postal_code: "1234",
      });

      expect(res.status).toBe(400);
    });

    it("400 — rejette si country manquant", async () => {
      const res = await api.post("/address/validate").send({
        street: "1 rue Test",
        city: "Douala",
        postal_code: "1234",
      });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /addresses ───────────────────────────────────────────────────────

  describe("POST /addresses", () => {
    it("201 — crée une adresse", async () => {
      const res = await api
        .post("/addresses")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          street: "1 rue de Test",
          city: "Yaoundé",
          country: "CM",
          postalCode: "0000",
          isDefault: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(true);
      expect(res.body.data.city).toBe("Yaoundé");
      expect(res.body.data.userId).toBe(regularUser.id);

      createdAddressId = res.body.data.id;
    });

    it("201 — crée une adresse par défaut et désactive les autres", async () => {
      // Créer une première adresse par défaut
      await api
        .post("/addresses")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          street: "2 rue de Test",
          city: "Douala",
          country: "CM",
          postalCode: "1111",
          isDefault: true,
        });

      // Créer une seconde adresse par défaut
      const res = await api
        .post("/addresses")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          street: "3 rue de Test",
          city: "Bafoussam",
          country: "CM",
          postalCode: "2222",
          isDefault: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.isDefault).toBe(true);

      // Vérifier que la précédente n'est plus default
      const allRes = await api
        .get("/addresses")
        .set("Authorization", `Bearer ${userTok}`);

      const defaults = allRes.body.data.filter((a: any) => a.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].city).toBe("Bafoussam");
    });

    it("400 — rejette si street manquante", async () => {
      const res = await api
        .post("/addresses")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          city: "Yaoundé",
          country: "CM",
          postalCode: "0000",
        });

      expect(res.status).toBe(400);
    });

    it("400 — rejette si postalCode manquant", async () => {
      const res = await api
        .post("/addresses")
        .set("Authorization", `Bearer ${userTok}`)
        .send({
          street: "1 rue Test",
          city: "Yaoundé",
          country: "CM",
        });

      expect(res.status).toBe(400);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.post("/addresses").send({
        street: "1 rue Test",
        city: "Yaoundé",
        country: "CM",
        postalCode: "0000",
      });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /addresses ────────────────────────────────────────────────────────

  describe("GET /addresses", () => {
    it("200 — retourne les adresses de l'utilisateur connecté", async () => {
      const res = await api
        .get("/addresses")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((a: any) => {
        expect(a.userId).toBe(regularUser.id);
      });
    });

    it("200 — retourne un tableau vide pour un utilisateur sans adresse", async () => {
      const res = await api
        .get("/addresses")
        .set("Authorization", `Bearer ${otherTok}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get("/addresses");
      expect(res.status).toBe(401);
    });
  });

  // ── GET /addresses/:addressId ─────────────────────────────────────────────

  describe("GET /addresses/:addressId", () => {
    it("200 — retourne une adresse appartenant à l'utilisateur", async () => {
      const res = await api
        .get(`/addresses/${createdAddressId}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.id).toBe(createdAddressId);
    });

    it("403 — refusé si l'adresse appartient à un autre utilisateur", async () => {
      const res = await api
        .get(`/addresses/${createdAddressId}`)
        .set("Authorization", `Bearer ${otherTok}`);

      expect(res.status).toBe(403);
    });

    it("404 — adresse introuvable", async () => {
      const res = await api
        .get("/addresses/nonexistent-id")
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.get(`/addresses/${createdAddressId}`);
      expect(res.status).toBe(401);
    });
  });

  // ── PATCH /addresses/:addressId ───────────────────────────────────────────

  describe("PATCH /addresses/:addressId", () => {
    it("200 — met à jour une adresse", async () => {
      const res = await api
        .patch(`/addresses/${createdAddressId}`)
        .set("Authorization", `Bearer ${userTok}`)
        .send({ city: "Kribi" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.city).toBe("Kribi");
    });

    it("403 — refusé si l'adresse appartient à un autre utilisateur", async () => {
      const res = await api
        .patch(`/addresses/${createdAddressId}`)
        .set("Authorization", `Bearer ${otherTok}`)
        .send({ city: "Hacked" });

      expect(res.status).toBe(403);
    });

    it("404 — adresse introuvable", async () => {
      const res = await api
        .patch("/addresses/nonexistent-id")
        .set("Authorization", `Bearer ${userTok}`)
        .send({ city: "Anywhere" });

      expect(res.status).toBe(404);
    });

    it("401 — rejette sans token", async () => {
      const res = await api
        .patch(`/addresses/${createdAddressId}`)
        .send({ city: "Kribi" });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /addresses/:addressId ──────────────────────────────────────────

  describe("DELETE /addresses/:addressId", () => {
    it("403 — refusé si l'adresse appartient à un autre utilisateur", async () => {
      const res = await api
        .delete(`/addresses/${createdAddressId}`)
        .set("Authorization", `Bearer ${otherTok}`);

      expect(res.status).toBe(403);
    });

    it("401 — rejette sans token", async () => {
      const res = await api.delete(`/addresses/${createdAddressId}`);
      expect(res.status).toBe(401);
    });

    it("200 — supprime une adresse", async () => {
      const addr = await seedAddress(regularUser.id);

      const res = await api
        .delete(`/addresses/${addr.id}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
      expect(res.body.data.message).toBe("Address deleted successfully");
    });

    it("404 — adresse introuvable après suppression", async () => {
      const addr = await seedAddress(regularUser.id);
      await api
        .delete(`/addresses/${addr.id}`)
        .set("Authorization", `Bearer ${userTok}`);

      const res = await api
        .get(`/addresses/${addr.id}`)
        .set("Authorization", `Bearer ${userTok}`);

      expect(res.status).toBe(404);
    });
  });
});
