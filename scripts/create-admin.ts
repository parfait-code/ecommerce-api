// scripts/create-admin.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/shared/config/database";

async function main() {
  const username = process.argv[2] ?? "mon_admin";
  const email = process.argv[3] ?? "mon_admin@e-store.com";
  const password = process.argv[4] ?? "motdepassesecurise";

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });

  if (existing) {
    console.log(
      "Un utilisateur avec ce username ou email existe déjà:",
      existing.id,
    );
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      username,
      email,
      password: hashed,
      firstName: "Admin",
      lastName: "User",
    },
  });

  console.log("Admin créé avec succès:");
  console.log({ id: admin.id, username: admin.username, email: admin.email });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
