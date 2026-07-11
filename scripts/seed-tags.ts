// scripts/seed-tags.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

const tagsData = [
  { name: "Nouveauté", slug: "nouveaute" },
  { name: "Best-seller", slug: "best-seller" },
  { name: "Éco-responsable", slug: "eco-responsable" },
  { name: "Bois massif", slug: "bois-massif" },
  { name: "Scandinave", slug: "scandinave" },
  { name: "Industriel", slug: "industriel" },
  { name: "Petit espace", slug: "petit-espace" },
  { name: "Modulable", slug: "modulable" },
  { name: "Fait main", slug: "fait-main" },
  { name: "Livraison rapide", slug: "livraison-rapide" },
  { name: "Cuir", slug: "cuir" },
  { name: "Confort premium", slug: "confort-premium" },
];

// SKU produit → noms de tags à assigner (doivent exister dans tagsData)
const productTagsMapping: Record<string, string[]> = {
  "CANAPE-OSLO-3P": ["Nouveauté", "Scandinave", "Best-seller"],
  "CANAPE-BERLIN-ANGLE": ["Modulable", "Petit espace"],
  "CANAPE-LISBONNE-2P": ["Petit espace", "Nouveauté"],
  "FAUTEUIL-COMFY-RELAX": ["Best-seller", "Confort premium"],
  "FAUTEUIL-VINTAGE-CUIR": ["Cuir", "Fait main"],
  "TABLE-BASSE-NORDIK": ["Bois massif", "Scandinave", "Éco-responsable"],
  "TABLE-BASSE-MARBRE": ["Best-seller"],
  "MEUBLE-TV-HORIZON": ["Scandinave"],
  "LIT-MILANO-140": ["Nouveauté", "Confort premium"],
  "LIT-TOKYO-160": ["Scandinave", "Bois massif"],
  "MATELAS-CONFORT-140": ["Confort premium", "Best-seller"],
  "MATELAS-CONFORT-160": ["Confort premium", "Best-seller"],
  "ARMOIRE-3PORTES-OSLO": ["Bois massif"],
  "COMMODE-6TIROIRS-NOVA": ["Bois massif", "Fait main"],
  "CHEVET-NOVA-SUSP": ["Petit espace", "Fait main"],
  "TABLE-PROVENCE-EXT": ["Bois massif", "Modulable"],
  "TABLE-RONDE-COPENHAGUE": ["Scandinave", "Petit espace"],
  "CHAISE-COPENHAGUE-X4": ["Scandinave", "Best-seller"],
  "BUFFET-SCANDI-190": ["Scandinave", "Bois massif"],
  "BUREAU-WORKSTATION": ["Industriel", "Nouveauté"],
  "BUREAU-ANGLE-PRO": ["Industriel"],
  "CHAISE-BUREAU-ERGO": ["Confort premium", "Best-seller"],
  "SALON-JARDIN-RIVIERA": ["Livraison rapide"],
  "TRANSAT-BALI-X2": ["Livraison rapide", "Petit espace"],
  "ETAGERE-MURALE-OSLO": ["Petit espace", "Bois massif"],
  "MIROIR-ROND-SOLEIL": ["Fait main", "Nouveauté"],
};

async function createTag(data: { name: string; slug: string }) {
  const existing = await prisma.tag.findUnique({ where: { slug: data.slug } });

  if (existing) {
    console.log(`  ⚠️  Tag "${data.name}" existe déjà (ID: ${existing.id})`);
    return existing;
  }

  const tag = await prisma.tag.create({ data });
  console.log(`  ✅ Tag créé: "${tag.name}" (ID: ${tag.id})`);
  return tag;
}

async function assignTagsToProduct(
  productId: number,
  productSku: string,
  tagNames: string[],
  tagIdByName: Record<string, string>,
) {
  const tagIds = tagNames
    .map((name) => tagIdByName[name])
    .filter((id): id is string => !!id);

  if (tagIds.length === 0) {
    console.log(`  ⚠️  Aucun tag valide pour "${productSku}"`);
    return;
  }

  const existingLinks = await prisma.productTag.findMany({
    where: { productId },
    select: { tagId: true },
  });
  const existingTagIds = new Set(existingLinks.map((l) => l.tagId));
  const toAdd = tagIds.filter((id) => !existingTagIds.has(id));

  if (toAdd.length === 0) {
    console.log(`  ⚠️  Tags déjà assignés pour "${productSku}"`);
    return;
  }

  await prisma.productTag.createMany({
    data: toAdd.map((tagId) => ({ productId, tagId })),
  });

  console.log(`  ✅ ${toAdd.length} tag(s) assignés à "${productSku}"`);
}

async function main() {
  console.log("🚀 Début de la création des tags (furniture e-store)...\n");

  // ── Étape 1 : créer les tags ────────────────────────────────
  console.log("📦 Étape 1: Création des tags");
  console.log("─".repeat(50));

  const tagIdByName: Record<string, string> = {};
  for (const tagData of tagsData) {
    const tag = await createTag(tagData);
    tagIdByName[tag.name] = tag.id;
  }

  console.log(`\n✅ ${tagsData.length} tags créés/vérifiés\n`);

  // ── Étape 2 : résoudre les produits par SKU ─────────────────
  const skus = Object.keys(productTagsMapping);
  const products = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true },
  });
  const productBySku = new Map(products.map((p) => [p.sku, p]));

  const missingSkus = skus.filter((sku) => !productBySku.has(sku));
  if (missingSkus.length > 0) {
    console.error(
      "\n⚠️  Produits introuvables (lance d'abord seed-products.ts):",
    );
    missingSkus.forEach((sku) => console.error(`   - ${sku}`));
  }

  // ── Étape 3 : assigner les tags ─────────────────────────────
  console.log("📦 Étape 2: Assignation des tags aux produits");
  console.log("─".repeat(50));

  for (const [sku, tagNames] of Object.entries(productTagsMapping)) {
    const product = productBySku.get(sku);
    if (!product) continue;

    console.log(`  ➜ "${sku}":`);
    await assignTagsToProduct(product.id, sku, tagNames, tagIdByName);
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 Création des tags terminée!");
  console.log("=".repeat(50));
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création des tags:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
