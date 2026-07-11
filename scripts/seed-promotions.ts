// scripts/seed-promotions.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

// Dates calculées dynamiquement (relatives à "aujourd'hui") pour que le
// script reste valide quelle que soit la date d'exécution — contrairement
// à des dates hardcodées qui finissent par expirer.
const now = new Date();
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

interface DiscountDef {
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  categorySlug?: string;
  productSkus?: string[];
}

interface CouponDef {
  code: string;
  maxUses?: number;
  perUserLimit: number;
  minOrderAmount?: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

interface PromotionData {
  name: string;
  slug: string;
  description: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  discount?: DiscountDef;
  coupon?: CouponDef;
}

const promotionsData: PromotionData[] = [
  {
    name: "Soldes Salon",
    slug: "soldes-salon",
    description:
      "-15% sur toute la catégorie Salon : canapés, fauteuils, tables basses et meubles TV",
    startDate: daysFromNow(-2),
    endDate: daysFromNow(21),
    isActive: true,
    discount: { type: "PERCENTAGE", value: 15, categorySlug: "salon" },
  },
  {
    name: "Pack Chambre Cocooning",
    slug: "pack-chambre-cocooning",
    description:
      "-10% sur toute la catégorie Chambre : lits, matelas, armoires et chevets",
    startDate: daysFromNow(-1),
    endDate: daysFromNow(30),
    isActive: true,
    discount: { type: "PERCENTAGE", value: 10, categorySlug: "chambre" },
  },
  {
    name: "Édition limitée Berlin",
    slug: "edition-limitee-berlin",
    description: "Le canapé d'angle Berlin à prix exceptionnel, stock limité",
    startDate: daysFromNow(-1),
    endDate: daysFromNow(10),
    isActive: true,
    discount: {
      type: "FIXED_AMOUNT",
      value: 50000,
      productSkus: ["CANAPE-BERLIN-ANGLE"],
    },
  },
  {
    name: "Vente Flash Bureau",
    slug: "vente-flash-bureau",
    description:
      "-20% sur tout le mobilier de bureau, offre limitée dans le temps",
    startDate: daysFromNow(0),
    endDate: daysFromNow(5),
    isActive: true,
    discount: { type: "PERCENTAGE", value: 20, categorySlug: "bureau" },
    coupon: {
      code: "FLASH20",
      maxUses: 50,
      perUserLimit: 1,
      startDate: daysFromNow(0),
      endDate: daysFromNow(5),
      isActive: true,
    },
  },
  {
    name: "Bienvenue nouveaux clients",
    slug: "bienvenue-nouveaux-clients",
    description: "Code promo de bienvenue pour toute première commande",
    startDate: daysFromNow(-30),
    endDate: daysFromNow(180),
    isActive: true,
    // Pas de discount produit/catégorie — coupon autonome, valable sur
    // n'importe quel panier respectant le montant minimum.
    coupon: {
      code: "BIENVENUE10",
      maxUses: 500,
      perUserLimit: 1,
      minOrderAmount: 50000,
      startDate: daysFromNow(-30),
      endDate: daysFromNow(180),
      isActive: true,
    },
  },
];

async function resolveCategoryId(slug?: string): Promise<string | undefined> {
  if (!slug) return undefined;
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) {
    console.error(
      `  ❌ Catégorie "${slug}" non trouvée (lance seed-categories.ts d'abord)`,
    );
    return undefined;
  }
  return category.id;
}

async function resolveProductIds(skus?: string[]): Promise<number[]> {
  if (!skus || skus.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true },
  });
  const found = new Set(products.map((p) => p.sku));
  const missing = skus.filter((s) => !found.has(s));
  if (missing.length > 0) {
    console.error(
      `  ❌ Produits introuvables (lance seed-products.ts d'abord): ${missing.join(", ")}`,
    );
  }
  return products.map((p) => p.id);
}

async function createPromotion(data: PromotionData) {
  const existing = await prisma.promotion.findUnique({
    where: { slug: data.slug },
  });
  if (existing) {
    console.log(
      `  ⚠️  Promotion "${data.name}" existe déjà (ID: ${existing.id})`,
    );
    return existing;
  }

  const promotion = await prisma.promotion.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      isActive: data.isActive,
      status: data.startDate <= new Date() ? "ACTIVE" : "SCHEDULED",
    },
  });

  console.log(
    `  ✅ Promotion créée: "${promotion.name}" (ID: ${promotion.id})`,
  );
  return promotion;
}

async function createDiscount(promotionId: string, def: DiscountDef) {
  const categoryId = await resolveCategoryId(def.categorySlug);
  const productIds = await resolveProductIds(def.productSkus);

  if (!categoryId && productIds.length === 0) {
    console.error(
      "  ❌ Discount ignoré: ni catégorie ni produit valide résolu",
    );
    return null;
  }

  const discount = await prisma.discount.create({
    data: {
      promotionId,
      type: def.type,
      value: def.value,
      ...(categoryId && { categoryId }),
      ...(productIds.length > 0 && {
        products: { create: productIds.map((productId) => ({ productId })) },
      }),
    },
  });

  console.log(
    `  ✅ Discount ajouté: ${def.value}${def.type === "PERCENTAGE" ? "%" : " XAF"}` +
      (categoryId ? ` (catégorie)` : ` (${productIds.length} produit(s))`),
  );
  return discount;
}

async function createCoupon(promotionId: string, def: CouponDef) {
  const existing = await prisma.couponCode.findUnique({
    where: { code: def.code },
  });
  if (existing) {
    console.log(`  ⚠️  Coupon "${def.code}" existe déjà`);
    return existing;
  }

  const coupon = await prisma.couponCode.create({
    data: {
      code: def.code,
      promotionId,
      maxUses: def.maxUses,
      perUserLimit: def.perUserLimit,
      minOrderAmount: def.minOrderAmount,
      startDate: def.startDate,
      endDate: def.endDate,
      isActive: def.isActive,
    },
  });

  console.log(`  ✅ Coupon créé: "${coupon.code}"`);
  return coupon;
}

async function main() {
  console.log(
    "🚀 Début de la création des promotions (furniture e-store)...\n",
  );

  for (const promoData of promotionsData) {
    console.log(`\n➜ "${promoData.name}"`);
    console.log("─".repeat(50));

    const promotion = await createPromotion(promoData);
    if (!promotion) continue;

    if (promoData.discount) {
      await createDiscount(promotion.id, promoData.discount);
    }

    if (promoData.coupon) {
      await createCoupon(promotion.id, promoData.coupon);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(
    `🎉 Création terminée! ${promotionsData.length} promotion(s) traitée(s).`,
  );
  console.log("=".repeat(50));
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création des promotions:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
