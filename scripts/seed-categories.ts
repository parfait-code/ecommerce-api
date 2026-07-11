// scripts/seed-categories.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

interface CategoryData {
  name: string;
  slug: string;
  description: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
  children?: CategoryData[];
}

// ============================================================
// ARBRE DES CATÉGORIES — un seul niveau de parent/enfant (pas de
// petits-enfants), conforme au modèle Category.parentId de Prisma.
// ============================================================
const categoriesData: CategoryData[] = [
  {
    name: "Salon",
    slug: "salon",
    description:
      "Canapés, fauteuils, tables basses et meubles TV pour aménager votre salon",
    metaTitle: "Meubles de salon | Canapés, fauteuils, tables basses",
    metaDescription:
      "Découvrez notre sélection de meubles de salon pour un intérieur chaleureux et fonctionnel.",
    isActive: true,
    children: [
      {
        name: "Canapés",
        slug: "canapes",
        description: "Canapés 2, 3 places, angle et convertibles",
        isActive: true,
      },
      {
        name: "Fauteuils",
        slug: "fauteuils",
        description: "Fauteuils classiques, relax et fauteuils d'appoint",
        isActive: true,
      },
      {
        name: "Tables basses",
        slug: "tables-basses",
        description: "Tables basses en bois, verre, marbre et métal",
        isActive: true,
      },
      {
        name: "Meubles TV",
        slug: "meubles-tv",
        description: "Meubles TV et bancs multimédia",
        isActive: true,
      },
    ],
  },
  {
    name: "Chambre",
    slug: "chambre",
    description:
      "Lits, matelas, armoires et tables de chevet pour votre chambre",
    metaTitle: "Meubles de chambre | Lits, matelas, armoires, chevets",
    metaDescription:
      "Toute la literie et le mobilier de chambre pour un sommeil réparateur.",
    isActive: true,
    children: [
      {
        name: "Lits",
        slug: "lits",
        description: "Lits simples, doubles et têtes de lit",
        isActive: true,
      },
      {
        name: "Matelas",
        slug: "matelas",
        description: "Matelas mousse, mémoire de forme et ressorts",
        isActive: true,
      },
      {
        name: "Armoires & Commodes",
        slug: "armoires-commodes",
        description: "Armoires, commodes et dressings pour la chambre",
        isActive: true,
      },
      {
        name: "Tables de chevet",
        slug: "tables-de-chevet",
        description: "Chevets classiques et suspendus",
        isActive: true,
      },
    ],
  },
  {
    name: "Cuisine & Salle à manger",
    slug: "cuisine-salle-a-manger",
    description:
      "Tables, chaises et rangements pour la cuisine et la salle à manger",
    metaTitle: "Meubles de cuisine et salle à manger",
    metaDescription:
      "Tables à manger, chaises, buffets et rangements pour tous les styles.",
    isActive: true,
    children: [
      {
        name: "Tables à manger",
        slug: "tables-a-manger",
        description: "Tables extensibles, rondes et rectangulaires",
        isActive: true,
      },
      {
        name: "Chaises de salle à manger",
        slug: "chaises-salle-a-manger",
        description: "Chaises assorties, bancs et tabourets",
        isActive: true,
      },
      {
        name: "Buffets & Vaisseliers",
        slug: "buffets-vaisseliers",
        description: "Buffets, vaisseliers et meubles de rangement cuisine",
        isActive: true,
      },
    ],
  },
  {
    name: "Bureau",
    slug: "bureau",
    description:
      "Bureaux, chaises ergonomiques et rangements pour l'espace de travail",
    metaTitle: "Mobilier de bureau | Bureaux et chaises ergonomiques",
    metaDescription:
      "Aménagez votre espace de travail avec nos bureaux et solutions de rangement.",
    isActive: true,
    children: [
      {
        name: "Bureaux",
        slug: "bureaux",
        description: "Bureaux droits, d'angle et bureaux assis-debout",
        isActive: true,
      },
      {
        name: "Chaises de bureau",
        slug: "chaises-de-bureau",
        description: "Chaises ergonomiques et fauteuils de bureau",
        isActive: true,
      },
      {
        name: "Rangements de bureau",
        slug: "rangements-bureau",
        description: "Caissons, étagères et meubles de classement",
        isActive: true,
      },
    ],
  },
  {
    name: "Extérieur",
    slug: "exterieur",
    description:
      "Mobilier de jardin, terrasse et balcon résistant aux intempéries",
    metaTitle: "Mobilier extérieur | Jardin, terrasse, balcon",
    metaDescription:
      "Salons de jardin, transats et parasols conçus pour résister aux intempéries.",
    isActive: true,
    children: [
      {
        name: "Salons de jardin",
        slug: "salons-de-jardin",
        description: "Ensembles table et chaises pour jardin et terrasse",
        isActive: true,
      },
      {
        name: "Transats & Chaises longues",
        slug: "transats-chaises-longues",
        description: "Transats, chaises longues et bains de soleil",
        isActive: true,
      },
      {
        name: "Parasols & Ombrages",
        slug: "parasols-ombrages",
        description: "Parasols, voiles d'ombrage et pergolas",
        isActive: true,
      },
    ],
  },
  {
    name: "Rangement",
    slug: "rangement",
    description:
      "Étagères, dressings et meubles de rangement pour toute la maison",
    metaTitle: "Meubles de rangement | Étagères et dressings",
    metaDescription:
      "Optimisez l'espace de votre maison avec nos étagères et dressings.",
    isActive: true,
    children: [
      {
        name: "Étagères & Bibliothèques",
        slug: "etageres-bibliotheques",
        description: "Étagères murales, bibliothèques et meubles à cases",
        isActive: true,
      },
      {
        name: "Dressings",
        slug: "dressings",
        description: "Dressings modulables et penderies",
        isActive: true,
      },
    ],
  },
  {
    name: "Décoration",
    slug: "decoration",
    description:
      "Miroirs, luminaires et accessoires pour sublimer votre intérieur",
    metaTitle: "Décoration intérieure | Miroirs et luminaires",
    metaDescription:
      "Miroirs, luminaires et objets déco pour personnaliser chaque pièce.",
    isActive: true,
    children: [
      {
        name: "Miroirs",
        slug: "miroirs",
        description: "Miroirs muraux, ronds et sur pied",
        isActive: true,
      },
      {
        name: "Luminaires",
        slug: "luminaires",
        description: "Suspensions, lampadaires et lampes à poser",
        isActive: true,
      },
    ],
  },
  {
    name: "Bébé & Enfant",
    slug: "bebe-enfant",
    description: "Lits, rangements et mobilier adapté à la chambre d'enfant",
    metaTitle: "Meubles bébé et enfant",
    metaDescription:
      "Lits enfant et rangements pensés pour la sécurité et le confort des petits.",
    isActive: true,
    children: [
      {
        name: "Lits enfant",
        slug: "lits-enfant",
        description: "Lits évolutifs, lits cabane et lits superposés",
        isActive: true,
      },
      {
        name: "Rangement enfant",
        slug: "rangement-enfant",
        description: "Coffres à jouets et étagères basses",
        isActive: true,
      },
    ],
  },
];

async function createCategory(
  data: Omit<CategoryData, "children">,
  parentId?: string,
): Promise<any> {
  const existing = await prisma.category.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    console.log(
      `⚠️  Catégorie "${data.name}" (slug: ${data.slug}) existe déjà, ignorée.`,
    );
    return existing;
  }

  const category = await prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      isActive: data.isActive,
      ...(parentId && { parentId }),
    },
  });

  console.log(`✅ Catégorie créée: "${category.name}" (ID: ${category.id})`);
  return category;
}

async function main() {
  console.log(
    "🚀 Début de la création des catégories (furniture e-store)...\n",
  );

  let parentCount = 0;
  let childCount = 0;

  for (const parent of categoriesData) {
    const { children, ...parentFields } = parent;
    const parentCategory = await createCategory(parentFields);
    parentCount++;

    if (!children || children.length === 0) continue;

    console.log(
      `  ➜ Sous-catégories de "${parentCategory.name}" (${parentCategory.id}):`,
    );

    for (const child of children) {
      await createCategory(child, parentCategory.id);
      childCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 Création des catégories terminée!");
  console.log(
    `📊 Total: ${parentCount} catégories parentes + ${childCount} sous-catégories = ${parentCount + childCount} catégories`,
  );
  console.log("=".repeat(50));
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création des catégories:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
