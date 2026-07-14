// scripts/seed-popups.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

interface PopupDef {
  title: string;
  message?: string;
  imageUrl?: string;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  targetType: "PROMOTION" | "CATEGORY" | "PRODUCT" | "INFO" | "EXTERNAL_LINK";
  // Slug (PROMOTION/CATEGORY) ou SKU (PRODUCT) à résoudre en targetId réel.
  targetSlugOrSku?: string;
  externalUrl?: string;
  ctaLabel?: string;
  displayFrequency?: "ONCE_PER_SESSION" | "ONCE_PER_DAY" | "ALWAYS";
  priority?: number;
}

const now = new Date();
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

// ============================================================
// POPUPS — un par targetType pour couvrir tous les cas de
// résolution d'URL testés par popup.service.ts::resolveUrl()
// ============================================================
const popupsData: PopupDef[] = [
  {
    title: "Bienvenue sur notre boutique",
    message:
      "Découvrez notre nouvelle collection de mobilier scandinave et profitez de -10% avec le code BIENVENUE10 sur votre première commande.",
    isActive: true,
    targetType: "INFO",
    displayFrequency: "ONCE_PER_SESSION",
    priority: 10,
  },
  {
    title: "Vente flash Bureau",
    message: "-20% sur tout le mobilier de bureau, offre limitée dans le temps !",
    isActive: true,
    startDate: daysFromNow(0),
    endDate: daysFromNow(5),
    targetType: "PROMOTION",
    targetSlugOrSku: "vente-flash-bureau",
    ctaLabel: "En profiter",
    displayFrequency: "ONCE_PER_DAY",
    priority: 20,
  },
  {
    title: "Soldes Salon",
    message: "-15% sur toute la catégorie Salon : canapés, fauteuils, tables basses...",
    isActive: true,
    startDate: daysFromNow(-2),
    endDate: daysFromNow(21),
    targetType: "CATEGORY",
    targetSlugOrSku: "salon",
    ctaLabel: "Voir la catégorie",
    displayFrequency: "ONCE_PER_SESSION",
    priority: 15,
  },
  {
    title: "Le Canapé Oslo est de retour en stock",
    message: "Notre best-seller scandinave est de nouveau disponible en 3 coloris.",
    isActive: true,
    targetType: "PRODUCT",
    targetSlugOrSku: "CANAPE-OSLO-3P",
    ctaLabel: "Découvrir",
    displayFrequency: "ONCE_PER_DAY",
    priority: 5,
  },
  {
    title: "Suivez-nous sur Instagram",
    message: "Rejoignez notre communauté pour ne rien manquer de nos nouveautés.",
    isActive: true,
    targetType: "EXTERNAL_LINK",
    externalUrl: "https://instagram.com/e-store",
    ctaLabel: "Suivre",
    displayFrequency: "ONCE_PER_SESSION",
    priority: 1,
  },
];

async function resolveTargetId(popup: PopupDef): Promise<string | null> {
  if (!popup.targetSlugOrSku) return null;

  switch (popup.targetType) {
    case "PROMOTION": {
      const promotion = await prisma.promotion.findUnique({
        where: { slug: popup.targetSlugOrSku },
      });
      if (!promotion) {
        console.error(
          `  ❌ Promotion "${popup.targetSlugOrSku}" introuvable (lance seed-promotions.ts d'abord)`,
        );
        return null;
      }
      return promotion.id;
    }
    case "CATEGORY": {
      const category = await prisma.category.findUnique({
        where: { slug: popup.targetSlugOrSku },
      });
      if (!category) {
        console.error(
          `  ❌ Catégorie "${popup.targetSlugOrSku}" introuvable (lance seed-categories.ts d'abord)`,
        );
        return null;
      }
      return category.id;
    }
    case "PRODUCT": {
      const product = await prisma.product.findUnique({
        where: { sku: popup.targetSlugOrSku },
      });
      if (!product) {
        console.error(
          `  ❌ Produit "${popup.targetSlugOrSku}" introuvable (lance seed-products.ts d'abord)`,
        );
        return null;
      }
      return product.id;
    }
    default:
      return null;
  }
}

async function createPopup(def: PopupDef) {
  // Popup n'a pas de champ unique naturel (ni slug ni code) — idempotence
  // approximative par titre, comme pour les adresses dans seed-users.ts.
  const existing = await prisma.popup.findFirst({
    where: { title: def.title },
  });
  if (existing) {
    console.log(`  ⚠️  Popup "${def.title}" existe déjà (ID: ${existing.id})`);
    return existing;
  }

  const targetId = await resolveTargetId(def);
  if (
    ["PROMOTION", "CATEGORY", "PRODUCT"].includes(def.targetType) &&
    !targetId
  ) {
    console.error(`  ❌ Popup "${def.title}" ignoré: cible introuvable`);
    return null;
  }

  const popup = await prisma.popup.create({
    data: {
      title: def.title,
      message: def.message,
      imageUrl: def.imageUrl,
      isActive: def.isActive,
      startDate: def.startDate,
      endDate: def.endDate,
      targetType: def.targetType,
      targetId,
      externalUrl: def.externalUrl,
      ctaLabel: def.ctaLabel,
      displayFrequency: def.displayFrequency ?? "ONCE_PER_SESSION",
      priority: def.priority ?? 0,
    },
  });

  console.log(`  ✅ Popup créé: "${popup.title}" (${popup.targetType})`);
  return popup;
}

async function main() {
  console.log("🚀 Début de la création des popups...\n");

  let created = 0;
  for (const def of popupsData) {
    console.log(`\n➜ "${def.title}"`);
    console.log("─".repeat(50));
    const result = await createPopup(def);
    if (result) created++;
  }

  console.log("\n" + "=".repeat(50));
  console.log(
    `🎉 Terminé — ${created}/${popupsData.length} popup(s) traité(s).`,
  );
  console.log("=".repeat(50));
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création des popups:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });