// scripts/seed-products.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

interface ProductData {
  sku: string;
  name: string;
  description: string;
  price: number;
  categorySlug: string; // résolu en categoryId via lookup DB
  weight: number;
}

// ============================================================
// CATALOGUE PRODUITS — categorySlug doit correspondre à une
// sous-catégorie créée par seed-categories.ts
// ============================================================
const productsData: ProductData[] = [
  // ── Salon / Canapés ─────────────────────────────────────────
  {
    sku: "CANAPE-OSLO-3P",
    name: "Canapé 3 places Oslo",
    description: "Canapé scandinave en tissu gris chiné, pieds en bois massif",
    price: 285000,
    categorySlug: "canapes",
    weight: 45,
  },
  {
    sku: "CANAPE-BERLIN-ANGLE",
    name: "Canapé d'angle convertible Berlin",
    description:
      "Canapé d'angle réversible avec coffre de rangement et couchage",
    price: 420000,
    categorySlug: "canapes",
    weight: 68,
  },
  {
    sku: "CANAPE-LISBONNE-2P",
    name: "Canapé 2 places Lisbonne",
    description: "Canapé compact en velours, idéal petits espaces",
    price: 210000,
    categorySlug: "canapes",
    weight: 38,
  },

  // ── Salon / Fauteuils ────────────────────────────────────────
  {
    sku: "FAUTEUIL-COMFY-RELAX",
    name: "Fauteuil relax Comfy",
    description:
      "Fauteuil inclinable en cuir synthétique avec repose-pieds intégré",
    price: 165000,
    categorySlug: "fauteuils",
    weight: 22,
  },
  {
    sku: "FAUTEUIL-VINTAGE-CUIR",
    name: "Fauteuil vintage en cuir",
    description: "Fauteuil club en cuir véritable, style rétro",
    price: 145000,
    categorySlug: "fauteuils",
    weight: 20,
  },

  // ── Salon / Tables basses ───────────────────────────────────
  {
    sku: "TABLE-BASSE-NORDIK",
    name: "Table basse Nordik",
    description: "Table basse ronde en bois de chêne massif, style scandinave",
    price: 68000,
    categorySlug: "tables-basses",
    weight: 12,
  },
  {
    sku: "TABLE-BASSE-MARBRE",
    name: "Table basse plateau marbre",
    description: "Table basse piètement doré et plateau en marbre véritable",
    price: 95000,
    categorySlug: "tables-basses",
    weight: 18,
  },

  // ── Salon / Meubles TV ───────────────────────────────────────
  {
    sku: "MEUBLE-TV-HORIZON",
    name: "Meuble TV Horizon",
    description: "Meuble TV suspendu avec rangements fermés, finition chêne",
    price: 120000,
    categorySlug: "meubles-tv",
    weight: 30,
  },

  // ── Chambre / Lits ───────────────────────────────────────────
  {
    sku: "LIT-MILANO-140",
    name: "Lit double Milano 140x190",
    description: "Cadre de lit capitonné avec tête de lit rembourrée",
    price: 195000,
    categorySlug: "lits",
    weight: 38,
  },
  {
    sku: "LIT-TOKYO-160",
    name: "Lit double Tokyo 160x200",
    description: "Lit bas style japandi, structure bois massif",
    price: 230000,
    categorySlug: "lits",
    weight: 42,
  },

  // ── Chambre / Matelas ────────────────────────────────────────
  {
    sku: "MATELAS-CONFORT-140",
    name: "Matelas mémoire de forme 140x190",
    description:
      "Matelas à mémoire de forme, accueil moelleux, housse déhoussable",
    price: 110000,
    categorySlug: "matelas",
    weight: 25,
  },
  {
    sku: "MATELAS-CONFORT-160",
    name: "Matelas mémoire de forme 160x200",
    description:
      "Matelas à mémoire de forme, soutien ferme, housse déhoussable",
    price: 135000,
    categorySlug: "matelas",
    weight: 28,
  },

  // ── Chambre / Armoires & Commodes ───────────────────────────
  {
    sku: "ARMOIRE-3PORTES-OSLO",
    name: "Armoire 3 portes Oslo",
    description: "Armoire penderie 3 portes avec étagères intégrées",
    price: 275000,
    categorySlug: "armoires-commodes",
    weight: 60,
  },
  {
    sku: "COMMODE-6TIROIRS-NOVA",
    name: "Commode 6 tiroirs Nova",
    description: "Commode en bois massif avec 6 tiroirs à glissières",
    price: 145000,
    categorySlug: "armoires-commodes",
    weight: 35,
  },

  // ── Chambre / Tables de chevet ──────────────────────────────
  {
    sku: "CHEVET-NOVA-SUSP",
    name: "Table de chevet suspendue Nova",
    description: "Chevet flottant en bois avec tiroir, fixation murale incluse",
    price: 32000,
    categorySlug: "tables-de-chevet",
    weight: 5,
  },

  // ── Cuisine / Tables à manger ────────────────────────────────
  {
    sku: "TABLE-PROVENCE-EXT",
    name: "Table à manger extensible Provence",
    description: "Table en bois massif extensible de 6 à 10 couverts",
    price: 245000,
    categorySlug: "tables-a-manger",
    weight: 55,
  },
  {
    sku: "TABLE-RONDE-COPENHAGUE",
    name: "Table ronde Copenhague",
    description: "Table ronde 4 personnes, pied central en bois",
    price: 180000,
    categorySlug: "tables-a-manger",
    weight: 40,
  },

  // ── Cuisine / Chaises salle à manger ────────────────────────
  {
    sku: "CHAISE-COPENHAGUE-X4",
    name: "Lot de 4 chaises Copenhague",
    description: "Chaises en bois courbé et assise tissu, design scandinave",
    price: 98000,
    categorySlug: "chaises-salle-a-manger",
    weight: 20,
  },

  // ── Cuisine / Buffets ────────────────────────────────────────
  {
    sku: "BUFFET-SCANDI-190",
    name: "Buffet scandinave 190cm",
    description: "Buffet bas avec portes coulissantes et pieds compas",
    price: 210000,
    categorySlug: "buffets-vaisseliers",
    weight: 48,
  },

  // ── Bureau / Bureaux ─────────────────────────────────────────
  {
    sku: "BUREAU-WORKSTATION",
    name: "Bureau droit Workstation",
    description: "Bureau en bois et métal avec passe-câbles intégré",
    price: 135000,
    categorySlug: "bureaux",
    weight: 28,
  },
  {
    sku: "BUREAU-ANGLE-PRO",
    name: "Bureau d'angle Pro",
    description: "Bureau d'angle avec caisson de rangement intégré",
    price: 165000,
    categorySlug: "bureaux",
    weight: 34,
  },

  // ── Bureau / Chaises de bureau ───────────────────────────────
  {
    sku: "CHAISE-BUREAU-ERGO",
    name: "Chaise de bureau ergonomique",
    description: "Chaise ergonomique avec support lombaire réglable",
    price: 89000,
    categorySlug: "chaises-de-bureau",
    weight: 14,
  },

  // ── Extérieur / Salons de jardin ────────────────────────────
  {
    sku: "SALON-JARDIN-RIVIERA",
    name: "Salon de jardin Riviera",
    description:
      "Ensemble table et 4 fauteuils en résine tressée, coussins déhoussables",
    price: 380000,
    categorySlug: "salons-de-jardin",
    weight: 42,
  },

  // ── Extérieur / Transats ─────────────────────────────────────
  {
    sku: "TRANSAT-BALI-X2",
    name: "Lot de 2 transats Bali",
    description: "Transats pliables en aluminium et textilène",
    price: 95000,
    categorySlug: "transats-chaises-longues",
    weight: 16,
  },

  // ── Rangement / Étagères ─────────────────────────────────────
  {
    sku: "ETAGERE-MURALE-OSLO",
    name: "Étagère murale Oslo",
    description: "Étagère murale en bois massif, fixation invisible",
    price: 45000,
    categorySlug: "etageres-bibliotheques",
    weight: 10,
  },

  // ── Décoration / Miroirs ─────────────────────────────────────
  {
    sku: "MIROIR-ROND-SOLEIL",
    name: "Miroir rond Soleil",
    description: "Miroir rond avec cadre en rotin façon soleil",
    price: 38000,
    categorySlug: "miroirs",
    weight: 6,
  },
];

async function resolveCategoryIds(): Promise<Record<string, string>> {
  const slugs = [...new Set(productsData.map((p) => p.categorySlug))];
  const categories = await prisma.category.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });

  const map: Record<string, string> = {};
  for (const c of categories) map[c.slug] = c.id;

  const missing = slugs.filter((s) => !map[s]);
  if (missing.length > 0) {
    console.error(
      "❌ Catégories introuvables (lance d'abord seed-categories.ts):",
    );
    missing.forEach((s) => console.error(`   - ${s}`));
    process.exit(1);
  }

  return map;
}

async function createProduct(data: ProductData, categoryId: string) {
  const existing = await prisma.product.findUnique({
    where: { sku: data.sku },
  });

  if (existing) {
    console.log(`  ⚠️  Produit "${data.sku}" existe déjà (ID: ${existing.id})`);
    return existing;
  }

  const product = await prisma.product.create({
    data: {
      sku: data.sku,
      name: data.name,
      description: data.description,
      price: data.price,
      categoryId,
      weight: data.weight,
      status: "DRAFT", // un produit naît toujours en DRAFT (cf. product.service.ts::create)
    },
  });

  console.log(`  ✅ Produit créé: "${product.name}" (ID: ${product.id})`);
  return product;
}

async function main() {
  console.log("🚀 Début de la création des produits (furniture e-store)...\n");

  const categoryIdBySlug = await resolveCategoryIds();

  let created = 0;
  for (const productData of productsData) {
    const categoryId = categoryIdBySlug[productData.categorySlug];
    const result = await createProduct(productData, categoryId);
    if (result) created++;
  }

  console.log("\n" + "=".repeat(50));
  console.log(
    `🎉 Création terminée! ${created}/${productsData.length} produits traités.`,
  );
  console.log("=".repeat(50));

  console.log(
    "\n📋 SKUs créés (référence pour seed-tags.ts / seed-promotions.ts):",
  );
  productsData.forEach((p) => console.log(`   ${p.sku}`));
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création des produits:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
