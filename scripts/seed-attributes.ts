// scripts/seed-attributes.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

interface OptionDef {
  value: string;
  colorHex?: string;
  position: number;
}

interface AttributeDef {
  categorySlug: string;
  name: string;
  slug: string;
  type: "TEXT" | "NUMBER" | "COLOR" | "BOOLEAN" | "SELECT";
  isVariant: boolean;
  isFilterable: boolean;
  isRequired: boolean;
  position: number;
  options?: OptionDef[];
}

// ============================================================
// ATTRIBUTS PAR SOUS-CATÉGORIE
// - isVariant: true  → génère des ProductCombination (voir seed-combinations.ts)
// - isVariant: false → simple caractéristique informative (setProductAttributes)
// ============================================================
const COLOR_OPTIONS: OptionDef[] = [
  { value: "Gris chiné", colorHex: "#8C8C8C", position: 0 },
  { value: "Bleu nuit", colorHex: "#1B2A4A", position: 1 },
  { value: "Beige", colorHex: "#E8DCC8", position: 2 },
  { value: "Vert olive", colorHex: "#5C6B3D", position: 3 },
];

const MATERIAL_OPTIONS: OptionDef[] = [
  { value: "Bois massif", position: 0 },
  { value: "Métal", position: 1 },
  { value: "Verre", position: 2 },
];

const attributesData: AttributeDef[] = [
  // ── Canapés ──────────────────────────────────────────────
  {
    categorySlug: "canapes",
    name: "Couleur",
    slug: "couleur",
    type: "COLOR",
    isVariant: true,
    isFilterable: true,
    isRequired: false,
    position: 0,
    options: COLOR_OPTIONS,
  },
  {
    categorySlug: "canapes",
    name: "Matériau",
    slug: "materiau",
    type: "SELECT",
    isVariant: false,
    isFilterable: true,
    isRequired: true,
    position: 1,
    options: MATERIAL_OPTIONS,
  },

  // ── Fauteuils ────────────────────────────────────────────
  {
    categorySlug: "fauteuils",
    name: "Couleur",
    slug: "couleur",
    type: "COLOR",
    isVariant: true,
    isFilterable: true,
    isRequired: false,
    position: 0,
    options: COLOR_OPTIONS,
  },

  // ── Lits ─────────────────────────────────────────────────
  {
    categorySlug: "lits",
    name: "Couleur",
    slug: "couleur",
    type: "COLOR",
    isVariant: true,
    isFilterable: true,
    isRequired: false,
    position: 0,
    options: [
      { value: "Chêne naturel", colorHex: "#C8A672", position: 0 },
      { value: "Noyer foncé", colorHex: "#4A3423", position: 1 },
      { value: "Blanc laqué", colorHex: "#F5F5F0", position: 2 },
    ],
  },
  {
    categorySlug: "lits",
    name: "Matériau",
    slug: "materiau",
    type: "SELECT",
    isVariant: false,
    isFilterable: true,
    isRequired: true,
    position: 1,
    options: MATERIAL_OPTIONS,
  },

  // ── Tables à manger ──────────────────────────────────────
  {
    categorySlug: "tables-a-manger",
    name: "Matériau",
    slug: "materiau",
    type: "SELECT",
    isVariant: false,
    isFilterable: true,
    isRequired: true,
    position: 0,
    options: MATERIAL_OPTIONS,
  },
];

async function resolveCategoryId(slug: string): Promise<string | null> {
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) {
    console.error(
      `  ❌ Catégorie "${slug}" introuvable (lance seed-categories.ts d'abord)`,
    );
    return null;
  }
  return category.id;
}

async function createAttribute(def: AttributeDef, categoryId: string) {
  const existing = await prisma.attributeDefinition.findUnique({
    where: { categoryId_slug: { categoryId, slug: def.slug } },
  });

  let definition = existing;
  if (existing) {
    console.log(
      `  ⚠️  Attribut "${def.name}" existe déjà pour "${def.categorySlug}" (ID: ${existing.id})`,
    );
  } else {
    definition = await prisma.attributeDefinition.create({
      data: {
        categoryId,
        name: def.name,
        slug: def.slug,
        type: def.type,
        isVariant: def.isVariant,
        isFilterable: def.isFilterable,
        isRequired: def.isRequired,
        position: def.position,
      },
    });
    console.log(
      `  ✅ Attribut créé: "${def.name}" pour "${def.categorySlug}" (ID: ${definition.id})`,
    );
  }

  if (!definition || !def.options) return definition;

  for (const opt of def.options) {
    const existingOption = await prisma.attributeOption.findUnique({
      where: {
        attributeDefinitionId_value: {
          attributeDefinitionId: definition.id,
          value: opt.value,
        },
      },
    });
    if (existingOption) continue;

    await prisma.attributeOption.create({
      data: {
        attributeDefinitionId: definition.id,
        value: opt.value,
        colorHex: opt.colorHex,
        position: opt.position,
      },
    });
    console.log(`     • option "${opt.value}" ajoutée`);
  }

  return definition;
}

async function main() {
  console.log("🚀 Début de la création des attributs...\n");

  let created = 0;
  for (const def of attributesData) {
    const categoryId = await resolveCategoryId(def.categorySlug);
    if (!categoryId) continue;

    console.log(`\n➜ ${def.categorySlug} / ${def.name}`);
    console.log("─".repeat(50));
    const result = await createAttribute(def, categoryId);
    if (result) created++;
  }

  console.log("\n" + "=".repeat(50));
  console.log(
    `🎉 Terminé — ${created}/${attributesData.length} définition(s) d'attribut traitée(s).`,
  );
  console.log("=".repeat(50));
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création des attributs:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
