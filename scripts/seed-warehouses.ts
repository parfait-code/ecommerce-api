// scripts/seed-warehouses.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

const warehousesData = [
  {
    name: "Entrepôt Douala",
    location: "Zone industrielle Bassa, Douala",
    capacity: 5000,
  },
  {
    name: "Entrepôt Yaoundé",
    location: "Zone industrielle Nkolbisson, Yaoundé",
    capacity: 3500,
  },
  {
    name: "Entrepôt Bafoussam",
    location: "Route de Bamenda, Bafoussam",
    capacity: 1500,
  },
];

async function createWarehouse(data: (typeof warehousesData)[number]) {
  const existing = await prisma.warehouse.findFirst({
    where: { name: data.name },
  });

  if (existing) {
    console.log(
      `  ⚠️  Entrepôt "${data.name}" existe déjà (ID: ${existing.id})`,
    );
    return existing;
  }

  const warehouse = await prisma.warehouse.create({ data });
  console.log(`  ✅ Entrepôt créé: "${warehouse.name}" (ID: ${warehouse.id})`);
  return warehouse;
}

async function main() {
  console.log("🚀 Début de la création des entrepôts...\n");

  const created: any[] = [];
  for (const data of warehousesData) {
    created.push(await createWarehouse(data));
  }

  console.log("\n" + "=".repeat(50));
  console.log(`🎉 Terminé — ${created.length} entrepôt(s) traité(s).`);
  console.log("=".repeat(50));

  console.log("\n📋 IDs des entrepôts (référence pour seed-inventory.ts):");
  created.forEach((w) => console.log(`   ${w.name} → ${w.id}`));
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création des entrepôts:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
