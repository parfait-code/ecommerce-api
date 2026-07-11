// scripts/seed-combinations.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

// SKU produit → couleurs à sélectionner (doivent exister comme options de
// l'attribut variant "Couleur" de la catégorie du produit).
const productVariantSelections: Record<string, string[]> = {
  "CANAPE-OSLO-3P": ["Gris chiné", "Bleu nuit", "Beige"],
  "CANAPE-LISBONNE-2P": ["Gris chiné", "Vert olive"],
  "FAUTEUIL-COMFY-RELAX": ["Gris chiné", "Beige"],
  "LIT-MILANO-140": ["Chêne naturel", "Noyer foncé", "Blanc laqué"],
};

// Réplique la logique de buildOptionsKey() de combination.service.ts —
// clé canonique triée, garantit l'unicité (productId, optionsKey).
const buildOptionsKey = (optionIds: string[]) =>
  [...optionIds].sort().join(":");

async function processProduct(sku: string, colorValues: string[]) {
  const product = await prisma.product.findUnique({
    where: { sku },
    select: { id: true, name: true, categoryId: true },
  });

  if (!product) {
    console.error(
      `  ❌ Produit "${sku}" introuvable (lance seed-products.ts d'abord)`,
    );
    return;
  }

  const attributeDefinition = await prisma.attributeDefinition.findUnique({
    where: {
      categoryId_slug: { categoryId: product.categoryId, slug: "couleur" },
    },
    include: { options: true },
  });

  if (!attributeDefinition || !attributeDefinition.isVariant) {
    console.error(
      `  ❌ Attribut variant "Couleur" introuvable pour la catégorie de "${sku}"`,
    );
    return;
  }

  const optionsToUse = attributeDefinition.options.filter((o) =>
    colorValues.includes(o.value),
  );

  if (optionsToUse.length === 0) {
    console.error(
      `  ❌ Aucune option de couleur correspondante trouvée pour "${sku}"`,
    );
    return;
  }

  console.log(`\n➜ ${product.name} (${sku})`);
  console.log("─".repeat(50));

  // 1) Enregistre la sélection d'options pour cet attribut (ProductAttributeSelection)
  for (const option of optionsToUse) {
    const existing = await prisma.productAttributeSelection.findUnique({
      where: {
        productId_attributeOptionId: {
          productId: product.id,
          attributeOptionId: option.id,
        },
      },
    });
    if (existing) continue;

    await prisma.productAttributeSelection.create({
      data: {
        productId: product.id,
        attributeDefinitionId: attributeDefinition.id,
        attributeOptionId: option.id,
      },
    });
  }
  console.log(
    `  ✅ ${optionsToUse.length} sélection(s) de couleur enregistrée(s)`,
  );

  // 2) Génère les combinaisons (produit cartésien — un seul attribut variant
  // ici, donc une combinaison par option) — même logique que
  // combinationService.generate() mais en écriture directe.
  let createdCount = 0;
  for (const option of optionsToUse) {
    const optionsKey = buildOptionsKey([option.id]);

    const existingCombination = await prisma.productCombination.findUnique({
      where: { productId_optionsKey: { productId: product.id, optionsKey } },
    });
    if (existingCombination) {
      console.log(`  ⚠️  Combinaison "${option.value}" existe déjà`);
      continue;
    }

    await prisma.productCombination.create({
      data: {
        productId: product.id,
        optionsKey,
        sku: `${sku}-${option.value.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
        values: {
          create: [
            {
              attributeDefinitionId: attributeDefinition.id,
              attributeOptionId: option.id,
            },
          ],
        },
      },
    });
    createdCount++;
    console.log(`  ✅ Combinaison créée: "${option.value}"`);
  }

  console.log(
    `  📊 ${createdCount} nouvelle(s) combinaison(s) sur ${optionsToUse.length} couleur(s)`,
  );
}

async function main() {
  console.log("🚀 Début de la génération des combinaisons (variantes)...\n");

  for (const [sku, colors] of Object.entries(productVariantSelections)) {
    await processProduct(sku, colors);
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 Génération des combinaisons terminée!");
  console.log("=".repeat(50));
  console.log(
    "\nℹ️  Rappel: un produit avec des combinaisons actives EXIGE un",
    "combination_id lors de l'ajout au panier / à la commande.",
  );
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la génération des combinaisons:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
