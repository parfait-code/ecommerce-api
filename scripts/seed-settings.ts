// scripts/seed-settings.ts
import "dotenv/config";
import { prisma } from "../src/shared/config/database";
import { DEFAULT_SETTINGS } from "../src/modules/settings/setting.constants";

async function main() {
  let created = 0;
  let skipped = 0;

  for (const setting of DEFAULT_SETTINGS) {
    const existing = await prisma.setting.findUnique({
      where: { key: setting.key },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.setting.create({ data: setting });
    created++;
    console.log(`✅ Setting créé: "${setting.key}" = ${setting.value}`);
  }

  console.log(
    `\n🎉 Terminé — ${created} setting(s) créé(s), ${skipped} déjà existant(s).`,
  );
}

main()
  .catch((err) => {
    console.error("❌ Erreur lors du seed des settings:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
