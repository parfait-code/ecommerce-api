import { prisma } from "../../../src/shared/config/database";

// ── Cleanup helpers ────────────────────────────────────────────────────────
// Toujours dans l'ordre inverse des FK pour éviter les violations de contrainte

export const cleanReviews = () =>
  prisma.review.deleteMany({
    where: { user: { username: { startsWith: "test_" } } },
  });

export const cleanReturns = () =>
  prisma.returnRequest.deleteMany({
    where: { user: { username: { startsWith: "test_" } } },
  });

export const cleanLoyalty = () =>
  prisma.loyaltyTransaction.deleteMany({
    where: { user: { username: { startsWith: "test_" } } },
  });

export const cleanCouponUses = () =>
  prisma.couponUse.deleteMany({
    where: { user: { username: { startsWith: "test_" } } },
  });

export const cleanPayments = () =>
  prisma.payment.deleteMany({
    where: { user: { username: { startsWith: "test_" } } },
  });

export const cleanOrders = () =>
  prisma.order.deleteMany({
    where: { user: { username: { startsWith: "test_" } } },
  });

export const cleanBaskets = () =>
  prisma.basket.deleteMany({
    where: { user: { username: { startsWith: "test_" } } },
  });

export const cleanWishlists = () =>
  prisma.wishlist.deleteMany({
    where: { user: { username: { startsWith: "test_" } } },
  });

export const cleanAddresses = () =>
  prisma.address.deleteMany({
    where: { user: { username: { startsWith: "test_" } } },
  });

export const cleanPickupRequests = () =>
  prisma.pickupRequest.deleteMany({
    where: { user: { username: { startsWith: "test_" } } },
  });

export const cleanInventory = () =>
  prisma.inventory.deleteMany({
    where: { product: { sku: { startsWith: "TEST-" } } },
  });

export const cleanProducts = () =>
  prisma.product.deleteMany({ where: { sku: { startsWith: "TEST-" } } });

export const cleanCategories = () =>
  prisma.category.deleteMany({ where: { slug: { startsWith: "test-" } } });

export const cleanWarehouses = () =>
  prisma.warehouse.deleteMany({ where: { name: { startsWith: "Test " } } });

export const cleanShipments = () =>
  prisma.shipment.deleteMany({
    where: { senderName: { startsWith: "Test " } },
  });

export const cleanPromotions = () =>
  prisma.promotion.deleteMany({ where: { slug: { startsWith: "test-" } } });

export const cleanUsers = () =>
  prisma.user.deleteMany({ where: { username: { startsWith: "test_" } } });

// ── Seed helpers ───────────────────────────────────────────────────────────

export const seedUser = (
  overrides: {
    username?: string;
    email?: string;
    role?: "USER" | "ADMIN" | "MANAGER" | "SUPPORT";
  } = {},
) => {
  const ts = Date.now();
  return prisma.user.create({
    data: {
      username: overrides.username ?? `test_user_${ts}`,
      email: overrides.email ?? `test_${ts}@example.com`,
      // bcrypt hash de "secret123" — fixe pour les tests
      password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
      firstName: "Test",
      lastName: "User",
      role: overrides.role ?? "USER",
    },
  });
};

export const seedCategory = (
  overrides: {
    name?: string;
    slug?: string;
  } = {},
) => {
  const ts = Date.now();
  return prisma.category.create({
    data: {
      name: overrides.name ?? `Test Category ${ts}`,
      slug: overrides.slug ?? `test-cat-${ts}`,
    },
  });
};

export const seedProduct = (
  categoryId: string,
  overrides: {
    sku?: string;
    name?: string;
    price?: number;
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  } = {},
) => {
  const ts = Date.now();
  return prisma.product.create({
    data: {
      sku: overrides.sku ?? `TEST-${ts}`,
      name: overrides.name ?? `Test Product ${ts}`,
      price: overrides.price ?? 1000,
      categoryId,
      status: overrides.status ?? "ACTIVE",
    },
  });
};

export const seedWarehouse = (
  overrides: {
    name?: string;
    location?: string;
  } = {},
) => {
  const ts = Date.now();
  return prisma.warehouse.create({
    data: {
      name: overrides.name ?? `Test Warehouse ${ts}`,
      location: overrides.location ?? "Test Location",
    },
  });
};

export const seedAddress = (
  userId: number,
  overrides: {
    isDefault?: boolean;
  } = {},
) =>
  prisma.address.create({
    data: {
      userId,
      street: "1 rue de Test",
      city: "Yaoundé",
      country: "CM",
      postalCode: "0000",
      isDefault: overrides.isDefault ?? false,
    },
  });

export const seedBasket = (userId: number) =>
  prisma.basket.create({ data: { userId } });

export const seedPromotion = (
  overrides: {
    name?: string;
    slug?: string;
  } = {},
) => {
  const ts = Date.now();
  const start = new Date();
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return prisma.promotion.create({
    data: {
      name: overrides.name ?? `Test Promotion ${ts}`,
      slug: overrides.slug ?? `test-promo-${ts}`,
      status: "ACTIVE",
      isActive: true,
      startDate: start,
      endDate: end,
    },
  });
};
