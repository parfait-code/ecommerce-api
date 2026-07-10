// scripts/create-categories.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";

interface CategoryPayload {
  name: string;
  slug: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
  parentId?: string;
}

interface CategoryData {
  name: string;
  slug: string;
  description: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
  parentId?: string;
  children?: CategoryData[];
}

// Définition des catégories directement dans le script
const categoriesData: CategoryData[] = [
  {
    name: "Salon",
    slug: "salon",
    description:
      "Canapés, fauteuils, tables basses et meubles TV pour aménager votre salon",
    metaTitle: "Meubles de salon | Canapés, fauteuils, tables basses",
    metaDescription:
      "Découvrez notre sélection de meubles de salon : canapés, fauteuils, tables basses et meubles TV pour un intérieur chaleureux.",
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
        description: "Tables basses en bois, verre et métal",
        isActive: true,
      },
    ],
  },
  {
    name: "Chambre",
    slug: "chambre",
    description:
      "Lits, matelas, armoires et tables de chevet pour votre chambre",
    metaTitle: "Meubles de chambre | Lits, armoires, chevets",
    metaDescription:
      "Toute la literie et le mobilier de chambre : lits, matelas, armoires, commodes et tables de chevet.",
    isActive: true,
    children: [
      {
        name: "Lits",
        slug: "lits",
        description: "Lits simples, doubles et têtes de lit",
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
      "Tables à manger, chaises, buffets et rangements de cuisine pour tous les styles.",
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
      "Aménagez votre espace de travail avec nos bureaux, chaises ergonomiques et solutions de rangement.",
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
    ],
  },
  {
    name: "Extérieur",
    slug: "exterieur",
    description:
      "Mobilier de jardin, terrasse et balcon résistant aux intempéries",
    metaTitle: "Mobilier extérieur | Jardin, terrasse, balcon",
    metaDescription:
      "Salons de jardin, chaises longues et tables d'extérieur conçus pour résister aux intempéries.",
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
      "Optimisez l'espace de votre maison avec nos étagères, bibliothèques et dressings.",
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
];

async function createCategory(data: CategoryPayload): Promise<any> {
  // Vérifier si la catégorie existe déjà
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
      ...(data.parentId && { parentId: data.parentId }),
    },
  });

  console.log(`✅ Catégorie créée: "${category.name}" (ID: ${category.id})`);
  return category;
}

async function main() {
  console.log("🚀 Début de la création des catégories...\n");

  // Étape 1: Créer toutes les catégories parentes
  console.log("📦 Étape 1: Création des catégories parentes");
  console.log("─".repeat(50));

  const parentCategories: Record<string, any> = {};

  for (const parent of categoriesData) {
    const category = await createCategory({
      name: parent.name,
      slug: parent.slug,
      description: parent.description || "",
      metaTitle: parent.metaTitle,
      metaDescription: parent.metaDescription,
      isActive: parent.isActive,
    });

    // Stocker l'ID du parent pour les enfants
    parentCategories[parent.slug] = category;
  }

  console.log("\n✅ Catégories parentes créées avec succès!");
  console.log("─".repeat(50));

  // Afficher les IDs des parents pour référence
  console.log("\n📋 IDs des catégories parentes:");
  for (const [slug, category] of Object.entries(parentCategories)) {
    console.log(`  ${slug} → ${category.id}`);
  }

  // Étape 2: Créer les sous-catégories
  console.log("\n📦 Étape 2: Création des sous-catégories");
  console.log("─".repeat(50));

  let childrenCount = 0;

  for (const parent of categoriesData) {
    if (!parent.children || parent.children.length === 0) continue;

    const parentCategory = parentCategories[parent.slug];
    if (!parentCategory) {
      console.error(
        `❌ Parent "${parent.slug}" non trouvé, impossible de créer les enfants.`,
      );
      continue;
    }

    console.log(
      `\n  ➜ Sous-catégories de "${parent.name}" (${parentCategory.id}):`,
    );

    for (const child of parent.children) {
      await createCategory({
        name: child.name,
        slug: child.slug,
        description: child.description || "",
        metaTitle: child.metaTitle,
        metaDescription: child.metaDescription,
        isActive: child.isActive,
        parentId: parentCategory.id,
      });
      childrenCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`🎉 Création terminée avec succès!`);
  console.log(
    `📊 Total: ${categoriesData.length} catégories parentes + ${childrenCount} sous-catégories = ${categoriesData.length + childrenCount} catégories`,
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
