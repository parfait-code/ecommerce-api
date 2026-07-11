// scripts/seed-shipping-methods.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

// zones : codes ISO 3166-1 alpha-2 — doivent appartenir à la liste des pays
// supportés (SUPPORTED_COUNTRIES / store.supported_countries).
const shippingMethodsData = [
  {
    name: "Livraison standard",
    description: "Livraison à domicile en 5 à 7 jours ouvrés",
    estimatedDays: 6,
    basePrice: 3000,
    pricePerKg: 200,
    isActive: true,
    zones: ["CM", "SN", "CI", "GH", "NG"],
  },
  {
    name: "Livraison express",
    description:
      "Livraison prioritaire en 24 à 48h (grandes villes uniquement)",
    estimatedDays: 2,
    basePrice: 8000,
    pricePerKg: 400,
    isActive: true,
    zones: ["CM"],
  },
  {
    name: "Livraison internationale",
    description: "Livraison hors Afrique centrale/de l'ouest, délais variables",
    estimatedDays: 15,
    basePrice: 25000,
    pricePerKg: 1500,
    isActive: true,
    zones: ["FR", "US", "GB"],
  },
  {
    name: "Retrait en entrepôt",
    description:
      "Récupération gratuite directement en entrepôt, sur rendez-vous",
    estimatedDays: 1,
    basePrice: 0,
    pricePerKg: 0,
    isActive: true,
    zones: ["CM"],
  },
];

async function createShippingMethod(
  data: (typeof shippingMethodsData)[number],
) {
  const existing = await prisma.shippingMethod.findFirst({
    where: { name: data.name },
  });

  if (existing) {
    console.log(
      `  ⚠️  Méthode "${data.name}" existe déjà (ID: ${existing.id})`,
    );
    return existing;
  }

  const method = await prisma.shippingMethod.create({ data });
  console.log(
    `  ✅ Méthode créée: "${method.name}" (${data.basePrice} XAF + ${data.pricePerKg} XAF/kg)`,
  );
  return method;
}

async function main() {
  console.log("🚀 Début de la création des méthodes de livraison...\n");

  let created = 0;
  for (const data of shippingMethodsData) {
    const result = await createShippingMethod(data);
    if (result) created++;
  }

  console.log("\n" + "=".repeat(50));
  console.log(
    `🎉 Terminé — ${created}/${shippingMethodsData.length} méthode(s) traitée(s).`,
  );
  console.log("=".repeat(50));
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création des méthodes de livraison:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
