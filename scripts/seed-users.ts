// scripts/seed-users.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/shared/config/database";

interface AddressDef {
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  country: string; // code ISO — doit être dans SUPPORTED_COUNTRIES
  postalCode?: string;
  isDefault: boolean;
}

interface UserDef {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  addresses: AddressDef[];
}

const DEFAULT_PASSWORD = "password123";

const usersData: UserDef[] = [
  {
    username: "marie_dubois",
    email: "marie.dubois@example.com",
    password: DEFAULT_PASSWORD,
    firstName: "Marie",
    lastName: "Dubois",
    phone: "+237690123456",
    addresses: [
      {
        recipientName: "Marie Dubois",
        phone: "+237690123456",
        street: "12 Avenue Kennedy",
        city: "Douala",
        country: "CM",
        isDefault: true,
      },
    ],
  },
  {
    username: "jean_mballa",
    email: "jean.mballa@example.com",
    password: DEFAULT_PASSWORD,
    firstName: "Jean",
    lastName: "Mballa",
    phone: "+237677889900",
    addresses: [
      {
        recipientName: "Jean Mballa",
        phone: "+237677889900",
        street: "Rue 1.234, Bastos",
        city: "Yaoundé",
        country: "CM",
        isDefault: true,
      },
      {
        recipientName: "Jean Mballa — Bureau",
        phone: "+237677889900",
        street: "Immeuble Titan, Avenue Charles de Gaulle",
        city: "Yaoundé",
        country: "CM",
        isDefault: false,
      },
    ],
  },
  {
    username: "aissatou_diallo",
    email: "aissatou.diallo@example.com",
    password: DEFAULT_PASSWORD,
    firstName: "Aissatou",
    lastName: "Diallo",
    phone: "+221771234567",
    addresses: [
      {
        recipientName: "Aissatou Diallo",
        phone: "+221771234567",
        street: "Cité Keur Gorgui, Villa 45",
        city: "Dakar",
        country: "SN",
        isDefault: true,
      },
    ],
  },
  {
    username: "manager_boutique",
    email: "manager@e-store.com",
    password: DEFAULT_PASSWORD,
    firstName: "Paul",
    lastName: "Nkeng",
    phone: "+237699887766",
    addresses: [],
  },
];

async function createUser(data: UserDef) {
  const existingUsername = await prisma.user.findUnique({
    where: { username: data.username },
  });
  const existingEmail = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUsername || existingEmail) {
    console.log(`  ⚠️  Utilisateur "${data.username}" existe déjà`);
    return existingUsername ?? existingEmail;
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: "USER",
    },
  });

  console.log(`  ✅ Utilisateur créé: "${user.username}" (${user.email})`);
  return user;
}

async function createAddresses(userId: number, addresses: AddressDef[]) {
  for (const addr of addresses) {
    // Idempotence approximative — évite les doublons exacts (mêmes street+city)
    const existing = await prisma.address.findFirst({
      where: { userId, street: addr.street, city: addr.city },
    });
    if (existing) continue;

    await prisma.address.create({
      data: {
        userId,
        recipientName: addr.recipientName,
        phone: addr.phone,
        street: addr.street,
        city: addr.city,
        country: addr.country,
        postalCode: addr.postalCode,
        isDefault: addr.isDefault,
      },
    });
    console.log(`     • adresse "${addr.city}" ajoutée`);
  }
}

async function main() {
  console.log(
    "🚀 Début de la création des utilisateurs clients (données de test)...\n",
  );
  console.log(
    `ℹ️  Mot de passe commun pour tous les comptes: "${DEFAULT_PASSWORD}"\n`,
  );

  let created = 0;
  for (const userData of usersData) {
    console.log(
      `\n➜ ${userData.firstName} ${userData.lastName} (${userData.username})`,
    );
    console.log("─".repeat(50));

    const user = await createUser(userData);
    if (!user) continue;
    created++;

    if (userData.addresses.length > 0) {
      await createAddresses(user.id, userData.addresses);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(
    `🎉 Terminé — ${created}/${usersData.length} utilisateur(s) traité(s).`,
  );
  console.log("=".repeat(50));

  console.log("\n📋 Identifiants de connexion (référence):");
  usersData.forEach((u) =>
    console.log(`   ${u.username} / ${DEFAULT_PASSWORD}`),
  );
}

main()
  .catch((err) => {
    console.error("\n❌ Erreur lors de la création des utilisateurs:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
