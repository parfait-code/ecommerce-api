import "dotenv/config";
import { prisma } from "../src/shared/config/database";

async function main() {
  const usersWithMultipleBaskets = await prisma.basket.groupBy({
    by: ["userId"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  console.log(
    `${usersWithMultipleBaskets.length} utilisateur(s) avec plusieurs paniers`,
  );

  for (const { userId } of usersWithMultipleBaskets) {
    const baskets = await prisma.basket.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { items: true },
    });

    const [keep, ...duplicates] = baskets;

    for (const dup of duplicates) {
      for (const item of dup.items) {
        const existing = await prisma.basketItem.findFirst({
          where: {
            basketId: keep.id,
            productId: item.productId,
            variantId: item.variantId,
          },
        });
        if (existing) {
          await prisma.basketItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: item.quantity } },
          });
        } else {
          await prisma.basketItem.create({
            data: {
              basketId: keep.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            },
          });
        }
      }
      await prisma.basket.delete({ where: { id: dup.id } });
    }
    console.log(
      `Utilisateur ${userId}: ${duplicates.length} panier(s) fusionné(s) dans ${keep.id}`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
