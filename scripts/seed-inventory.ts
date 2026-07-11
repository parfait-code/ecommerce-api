// scripts/seed-inventory.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

// Répartition simple : chaque ligne de stock (produit simple, ou couleur
// pour un produit à variantes) reçoit une quantité par entrepôt.
const STOCK_PER_WAREHOUSE = [
  { warehouseName: "Entrepôt Douala", quantity: 25 },
  { warehouseName: "Entrepôt Yaoundé", quantity: 15 },
  { warehouseName: "Entrepôt Bafoussam", quantity: 8 }, // volontairement bas → déclenche LOW_STOCK
];

async function resolveWarehouseIds(): Promise<Record<string, string>> {
  const warehouses = await prisma.warehouse.findMany({
    where: { name: { in: STOCK_PER_WAREHOUSE.map((w) => w.warehouseName) } },
    select: { id: true, name: true },
  });
  const map: Record<string, string> = {};
  for (const w of warehouses) map[w.name] = w.id;

  const missing = STOCK_PER_WAREHOUSE.filter((s) => !map[s.warehouseName]);
  if (missing.length > 0) {
    console.error(
      "❌ Entrepôts introuvables (lance seed-warehouses.ts d'abord):",
    );
    missing.forEach((m) => console.error(`   - ${m.warehouseName}`));
    process.exit(1);
  }
  return map;
}

async function createStockLine(
  productId: number,
  warehouseId: string,
  quantity: number,
  combinationId?: string,
) {
  const existing = combinationId
    ? await prisma.inventory.findUnique({
        where: {
          productId_warehouseId_combinationId: {
            productId,
            warehouseId,
            combinationId,
          },
        },
      })
    : await prisma.inventory.findFirst({
        where: { productId, warehouseId, combinationId: null },
      });

  if (existing) return { created: false };

  await prisma.inventory.create({
    data: {
      productId,
      warehouseId,
      combinationId: combinationId ?? null,
      quantity,
    },
  });
  return { created: true };
}

async function main() {
  console.log("🚀 Début de la création du stock...\n");

  const warehouseIdByName = await resolveWarehouseIds();

  const products = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      combinations: { select: { id: true, optionsKey: true } },
    },
  });

  if (products.length === 0) {
    console.error("❌ Aucun produit trouvé (lance seed-products.ts d'abord)");
    process.exit(1);
  }

  let linesCreated = 0;
  let linesSkipped = 0;

  for (const product of products) {
    // Produit à variantes → stock par combinaison, PAS sur le produit
    // directement (cohérent avec la règle métier d'inventory.service.ts:
    // "This product has active combinations — stock must be attached to a
    // specific combination").
    if (product.combinations.length > 0) {
      console.log(
        `\n➜ ${product.name} (${product.combinations.length} variante(s))`,
      );
      for (const combination of product.combinations) {
        for (const stock of STOCK_PER_WAREHOUSE) {
          const warehouseId = warehouseIdByName[stock.warehouseName];
          const result = await createStockLine(
            product.id,
            warehouseId,
            stock.quantity,
            combination.id,
          );
          if (result.created) linesCreated++;
          else linesSkipped++;
        }
      }
      console.log(
        `  ✅ Stock réparti sur ${STOCK_PER_WAREHOUSE.length} entrepôt(s) × ${product.combinations.length} variante(s)`,
      );
      continue;
    }

    // Produit simple → stock directement sur le produit
    console.log(`\n➜ ${product.name} (${product.sku})`);
    for (const stock of STOCK_PER_WAREHOUSE) {
      const warehouseId = warehouseIdByName[stock.warehouseName];
      const result = await createStockLine(
        product.id,
        warehouseId,
        stock.quantity,
      );
      if (result.created) linesCreated++;
      else linesSkipped++;
    }
    console.log(
      `  ✅ Stock réparti sur ${STOCK_PER_WAREHOUSE.length} entrepôt(s)`,
    );
  }

  console.log("\n" + "=".repeat(50));
  console.log(
    `🎉 Terminé — ${linesCreated} ligne(s) de stock créée(s), ${linesSkipped} déjà existante(s).`,
  );
  console.log("=".repeat(50));
  console.log(
    "\nℹ️  Note: l'entrepôt Bafoussam reçoit volontairement une quantité",
    "faible (8) pour tester les alertes LOW_STOCK du seuil configuré.",
  );
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création du stock:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
