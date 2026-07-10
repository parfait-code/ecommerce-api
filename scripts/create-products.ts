// scripts/create-products.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

// ============================================================
// DONNÉES DES CATÉGORIES - À METTRE À JOUR AVEC LES VRAIS IDs
// ============================================================
const CATEGORY_IDS: Record<string, string> = {
  // Salon
  SALON: "cmrdylu2i0000movdkvpi2cit",
  CANAPES: "cmrdylwzc0006movd2crxvu94",
  FAUTEUILS: "cmrdylxgk0007movdqikcefuu",
  TABLES_BASSES: "cmrdylxx30008movduiqfyd7n",

  // Chambre
  CHAMBRE: "cmrdyluku0001movdhgyjww5y",
  LITS: "cmrdylydk0009movdd4k0rgqr",
  CHEVETS: "cmrdylzq3000bmovduqwyhthg",

  // Cuisine & Salle à manger
  CUISINE: "cmrdylv0p0002movd4tfrhhr6",
  TABLES_MANGER: "cmrdym060000cmovdjwg34g3c",
  CHAISES_SAM: "cmrdym0lm000dmovdheltlka9",

  // Bureau
  BUREAU: "cmrdylvlh0003movdmyug87px",
  BUREAUX: "cmrdym1lg000fmovd66dqu5q8",
  CHAISES_BUREAU: "cmrdym2al000gmovd9dqupurp",

  // Extérieur
  EXTERIEUR: "cmrdylw2t0004movdwfup8wxz",
  SALONS_JARDIN: "cmrdym2qs000hmovd7cga2vkf",
};

// ============================================================
// DONNÉES DES TAGS
// ============================================================
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
];

// ============================================================
// DONNÉES DES PRODUITS
// ============================================================
const productsData = [
  {
    sku: "CANAPE-OSLO-3P",
    name: "Canapé 3 places Oslo",
    description: "Canapé scandinave en tissu gris chiné, pieds en bois massif",
    price: 285000,
    categoryKey: "CANAPES",
    weight: 45,
  },
  {
    sku: "CANAPE-BERLIN-ANGLE",
    name: "Canapé d'angle convertible Berlin",
    description: "Canapé d'angle réversible avec coffre de rangement et couchage",
    price: 420000,
    categoryKey: "CANAPES",
    weight: 68,
  },
  {
    sku: "FAUTEUIL-COMFY-RELAX",
    name: "Fauteuil relax Comfy",
    description: "Fauteuil inclinable en cuir synthétique avec repose-pieds intégré",
    price: 165000,
    categoryKey: "FAUTEUILS",
    weight: 22,
  },
  {
    sku: "TABLE-BASSE-NORDIK",
    name: "Table basse Nordik",
    description: "Table basse ronde en bois de chêne massif, style scandinave",
    price: 68000,
    categoryKey: "TABLES_BASSES",
    weight: 12,
  },
  {
    sku: "LIT-MILANO-140",
    name: "Lit double Milano 140x190",
    description: "Cadre de lit capitonné avec tête de lit rembourrée",
    price: 195000,
    categoryKey: "LITS",
    weight: 38,
  },
  {
    sku: "CHEVET-NOVA-SUSP",
    name: "Table de chevet suspendue Nova",
    description: "Chevet flottant en bois avec tiroir, fixation murale incluse",
    price: 32000,
    categoryKey: "CHEVETS",
    weight: 5,
  },
  {
    sku: "TABLE-PROVENCE-EXT",
    name: "Table à manger extensible Provence",
    description: "Table en bois massif extensible de 6 à 10 couverts",
    price: 245000,
    categoryKey: "TABLES_MANGER",
    weight: 55,
  },
  {
    sku: "CHAISE-COPENHAGUE-X4",
    name: "Lot de 4 chaises Copenhague",
    description: "Chaises en bois courbé et assise tissu, design scandinave",
    price: 98000,
    categoryKey: "CHAISES_SAM",
    weight: 20,
  },
  {
    sku: "BUREAU-WORKSTATION",
    name: "Bureau droit Workstation",
    description: "Bureau en bois et métal avec passe-câbles intégré",
    price: 135000,
    categoryKey: "BUREAUX",
    weight: 28,
  },
  {
    sku: "SALON-JARDIN-RIVIERA",
    name: "Salon de jardin Riviera",
    description: "Ensemble table et 4 fauteuils en résine tressée, coussins déhoussables",
    price: 380000,
    categoryKey: "SALONS_JARDIN",
    weight: 42,
  },
];

// ============================================================
// ASSIGNATION DES TAGS AUX PRODUITS
// ============================================================
const productTagsMapping: Record<string, string[]> = {
  "CANAPE-OSLO-3P": ["Nouveauté", "Scandinave", "Best-seller"],
  "CANAPE-BERLIN-ANGLE": ["Modulable", "Petit espace"],
  "FAUTEUIL-COMFY-RELAX": ["Best-seller"],
  "TABLE-BASSE-NORDIK": ["Bois massif", "Scandinave", "Éco-responsable"],
  "LIT-MILANO-140": ["Nouveauté"],
  "CHEVET-NOVA-SUSP": ["Petit espace", "Fait main"],
  "TABLE-PROVENCE-EXT": ["Bois massif", "Modulable"],
  "CHAISE-COPENHAGUE-X4": ["Scandinave", "Best-seller"],
  "BUREAU-WORKSTATION": ["Industriel", "Nouveauté"],
  "SALON-JARDIN-RIVIERA": ["Livraison rapide"],
};

// ============================================================
// DONNÉES DES PROMOTIONS
// ============================================================
const promotionsData = [
  {
    name: "Soldes Salon",
    slug: "soldes-salon",
    description: "-15% sur toute la catégorie Salon : canapés, fauteuils et tables basses",
    startDate: new Date("2026-07-10T00:00:00.000Z"),
    endDate: new Date("2026-07-31T23:59:59.000Z"),
    isActive: true,
    discount: {
      type: "PERCENTAGE" as const,
      value: 15,
      categoryKey: "SALON",
    },
  },
  {
    name: "Édition limitée Berlin",
    slug: "edition-limitee-berlin",
    description: "Le canapé d'angle Berlin à prix exceptionnel, stock limité",
    startDate: new Date("2026-07-10T00:00:00.000Z"),
    endDate: new Date("2026-07-20T23:59:59.000Z"),
    isActive: true,
    discount: {
      type: "FIXED_AMOUNT" as const,
      value: 50000,
      productSku: "CANAPE-BERLIN-ANGLE",
    },
  },
  {
    name: "Bienvenue nouveaux clients",
    slug: "bienvenue-nouveaux-clients",
    description: "Code promo de bienvenue pour toute première commande",
    startDate: new Date("2026-07-10T00:00:00.000Z"),
    endDate: new Date("2026-12-31T23:59:59.000Z"),
    isActive: true,
    coupon: {
      code: "BIENVENUE10",
      maxUses: 500,
      perUserLimit: 1,
      startDate: new Date("2026-07-10T00:00:00.000Z"),
      endDate: new Date("2026-12-31T23:59:59.000Z"),
      isActive: true,
    },
  },
];

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

async function createTag(data: { name: string; slug: string }) {
  const existing = await prisma.tag.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    console.log(`  ⚠️  Tag "${data.name}" existe déjà (ID: ${existing.id})`);
    return existing;
  }

  const tag = await prisma.tag.create({
    data: {
      name: data.name,
      slug: data.slug,
    },
  });

  console.log(`  ✅ Tag créé: "${tag.name}" (ID: ${tag.id})`);
  return tag;
}

async function createProduct(data: any) {
  const existing = await prisma.product.findUnique({
    where: { sku: data.sku },
  });

  if (existing) {
    console.log(`  ⚠️  Produit "${data.sku}" existe déjà (ID: ${existing.id})`);
    return existing;
  }

  const categoryId = CATEGORY_IDS[data.categoryKey as keyof typeof CATEGORY_IDS];
  if (!categoryId || categoryId === "") {
    console.error(`  ❌ Catégorie "${data.categoryKey}" non trouvée dans CATEGORY_IDS`);
    return null;
  }

  const product = await prisma.product.create({
    data: {
      sku: data.sku,
      name: data.name,
      description: data.description,
      price: data.price,
      categoryId: categoryId,
      weight: data.weight,
      status: "DRAFT",
    },
  });

  console.log(`  ✅ Produit créé: "${product.name}" (ID: ${product.id})`);
  return product;
}

async function assignTagsToProduct(product: any, tagNames: string[], allTags: any[]) {
  const tagIds = tagNames
    .map(name => allTags.find(t => t.name === name)?.id)
    .filter((id): id is string => id !== undefined && id !== "");

  if (tagIds.length === 0) {
    console.log(`  ⚠️  Aucun tag valide à assigner`);
    return;
  }

  // Récupérer les tags existants du produit
  const existingTags = await prisma.productTag.findMany({
    where: { productId: product.id },
    select: { tagId: true },
  });

  const existingTagIds = existingTags.map(t => t.tagId);
  const tagsToAdd = tagIds.filter(id => !existingTagIds.includes(id));

  if (tagsToAdd.length === 0) {
    console.log(`  ⚠️  Tous les tags sont déjà assignés`);
    return;
  }

  // Ajouter les nouveaux tags un par un
  for (const tagId of tagsToAdd) {
    await prisma.productTag.create({
      data: {
        productId: product.id,
        tagId: tagId,
      },
    });
  }

  console.log(`  ✅ ${tagsToAdd.length} tag(s) assignés`);
}

// ============================================================
// FONCTION PRINCIPALE
// ============================================================

async function main() {
  console.log("🚀 Début de la création des produits, tags et promotions...\n");

  // Vérifier les IDs des catégories
  const missingCategories = Object.entries(CATEGORY_IDS)
    .filter(([key, value]) => value === "" || !value)
    .map(([key]) => key);

  if (missingCategories.length > 0) {
    console.error("❌ Erreur: Certains IDs de catégories ne sont pas configurés:");
    missingCategories.forEach(key => console.error(`   - ${key}`));
    console.error("\n📝 Mettez à jour CATEGORY_IDS avec les vrais IDs générés par create-categories.ts");
    process.exit(1);
  }

  // ============================================================
  // ÉTAPE 1: Créer les tags
  // ============================================================
  console.log("📦 Étape 1: Création des tags");
  console.log("─".repeat(50));

  const createdTags: any[] = [];
  for (const tagData of tagsData) {
    const tag = await createTag(tagData);
    createdTags.push(tag);
  }

  console.log(`\n✅ ${createdTags.length} tags créés\n`);

  // ============================================================
  // ÉTAPE 2: Créer les produits
  // ============================================================
  console.log("📦 Étape 2: Création des produits");
  console.log("─".repeat(50));

  const createdProducts: any[] = [];
  for (const productData of productsData) {
    const product = await createProduct(productData);
    if (product) {
      createdProducts.push(product);
    }
  }

  console.log(`\n✅ ${createdProducts.length} produits créés\n`);

  // ============================================================
  // ÉTAPE 3: Assigner les tags aux produits
  // ============================================================
  console.log("📦 Étape 3: Assignation des tags aux produits");
  console.log("─".repeat(50));

  for (const product of createdProducts) {
    const tagNames = productTagsMapping[product.sku];
    if (!tagNames || tagNames.length === 0) {
      console.log(`  ⚠️  Aucun tag défini pour "${product.sku}"`);
      continue;
    }

    console.log(`  ➜ "${product.name}" (${product.sku}):`);
    await assignTagsToProduct(product, tagNames, createdTags);
  }

  console.log("\n");

  // ============================================================
  // ÉTAPE 4: Créer les promotions
  // ============================================================
  console.log("📦 Étape 4: Création des promotions");
  console.log("─".repeat(50));

  for (const promoData of promotionsData) {
    console.log(`\n  ➜ "${promoData.name}"`);

    // Vérifier si la promotion existe déjà
    const existingPromo = await prisma.promotion.findUnique({
      where: { slug: promoData.slug },
    });

    if (existingPromo) {
      console.log(`  ⚠️  Promotion existe déjà (ID: ${existingPromo.id})`);
      continue;
    }

    // Créer la promotion
    const promotion = await prisma.promotion.create({
      data: {
        name: promoData.name,
        slug: promoData.slug,
        description: promoData.description,
        startDate: promoData.startDate,
        endDate: promoData.endDate,
        isActive: promoData.isActive,
      },
    });

    console.log(`  ✅ Promotion créée (ID: ${promotion.id})`);

    // Ajouter le discount si présent
    if (promoData.discount) {
      const discount = promoData.discount;

      let categoryId: string | undefined;
      let productIds: string[] | undefined;

      if (discount.categoryKey) {
        categoryId = CATEGORY_IDS[discount.categoryKey as keyof typeof CATEGORY_IDS];
        if (!categoryId || categoryId === "") {
          console.error(`  ❌ Catégorie "${discount.categoryKey}" non trouvée`);
          continue;
        }
      }

      if (discount.productSku) {
        const product = createdProducts.find((p: any) => p.sku === discount.productSku);
        if (product) {
          productIds = [product.id];
        } else {
          console.error(`  ❌ Produit "${discount.productSku}" non trouvé`);
          continue;
        }
      }

      // Créer le discount avec la bonne structure
      const discountData: any = {
        type: discount.type,
        value: discount.value,
        promotionId: promotion.id,
      };

      if (categoryId) {
        discountData.categoryId = categoryId;
      }

      // CORRECTION ICI: Utiliser "products" au lieu de "productIds"
      // et créer la relation via DiscountProduct
      if (productIds && productIds.length > 0) {
        discountData.products = {
          create: productIds.map(productId => ({
            productId: productId,
          })),
        };
      }

      await prisma.discount.create({
        data: discountData,
      });

      console.log(`  ✅ Discount ajouté: ${discount.value}${discount.type === "PERCENTAGE" ? "%" : " XAF"}`);
    }

    // Ajouter le coupon si présent
    if (promoData.coupon) {
      const existingCoupon = await prisma.couponCode.findFirst({
        where: { code: promoData.coupon.code },
      });

      if (existingCoupon) {
        console.log(`  ⚠️  Coupon "${promoData.coupon.code}" existe déjà`);
      } else {
        await prisma.couponCode.create({
          data: {
            code: promoData.coupon.code,
            maxUses: promoData.coupon.maxUses,
            perUserLimit: promoData.coupon.perUserLimit,
            startDate: promoData.coupon.startDate,
            endDate: promoData.coupon.endDate,
            isActive: promoData.coupon.isActive,
            promotionId: promotion.id,
          },
        });
        console.log(`  ✅ Coupon créé: "${promoData.coupon.code}"`);
      }
    }
  }

  // ============================================================
  // RÉCAPITULATIF
  // ============================================================
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Création terminée avec succès!");
  console.log(`📊 Résumé:`);
  console.log(`   - ${createdTags.length} tags créés`);
  console.log(`   - ${createdProducts.length} produits créés`);
  console.log(`   - ${promotionsData.length} promotions créées`);
  console.log("=".repeat(50));

  // Afficher les IDs importants
  console.log("\n📋 IDs des produits (à garder pour référence):");
  for (const product of createdProducts) {
    console.log(`   ${product.sku} → ${product.id}`);
  }

  console.log("\n📋 IDs des tags (à garder pour référence):");
  for (const tag of createdTags) {
    console.log(`   ${tag.slug} → ${tag.id}`);
  }
}

// ============================================================
// EXÉCUTION
// ============================================================

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });