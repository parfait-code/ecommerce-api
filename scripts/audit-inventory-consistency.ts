// scripts/audit-inventory-consistency.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

async function main() {
  console.log("🔍 Audit de cohérence stock direct vs. stock par combinaison\n");

  const rows = await prisma.inventory.findMany({
    select: {
      productId: true,
      combinationId: true,
      quantity: true,
      product: { select: { sku: true, name: true } },
    },
  });

  const byProduct = new Map<
    string,
    { sku: string; name: string; direct: number; combos: number }
  >();

  for (const row of rows) {
    const entry = byProduct.get(row.productId) ?? {
      sku: row.product.sku,
      name: row.product.name,
      direct: 0,
      combos: 0,
    };
    if (row.combinationId === null) entry.direct += row.quantity;
    else entry.combos += row.quantity;
    byProduct.set(row.productId, entry);
  }

  const violations = [...byProduct.entries()].filter(
    ([, v]) => v.direct > 0 && v.combos > 0,
  );

  if (violations.length === 0) {
    console.log("✅ Aucune incohérence détectée.");
  } else {
    console.log(`❌ ${violations.length} produit(s) avec un stock mixte:\n`);
    for (const [productId, v] of violations) {
      console.log(
        `  - ${v.name} (${v.sku}, id: ${productId}) — stock direct: ${v.direct}, stock combinaisons: ${v.combos}`,
      );
    }
    console.log(
      "\n⚠️  Pour chacun : transférer le stock direct vers la bonne combinaison (POST /inventory/transfer, ou suppression + recréation sous combination_id), ou retirer les combinaisons si le produit doit rester simple.",
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
