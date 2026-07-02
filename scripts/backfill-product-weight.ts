import "dotenv/config";
import { prisma } from "../src/shared/config/database";

async function main() {
  const result = await prisma.product.updateMany({
    where: { weight: null },
    data: { weight: 0.5 },
  });
  console.log(`${result.count} produit(s) mis à jour avec weight=0.5`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
