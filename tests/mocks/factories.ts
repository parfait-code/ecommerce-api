import { UserRole, ProductStatus, OrderStatus } from "@prisma/client";

export const makeUser = (overrides: Partial<any> = {}) => ({
  id: "user_test_id",
  username: "johndoe",
  email: "john@example.com",
  password: "$2a$10$hashedpassword",
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: null,
  phone: null,
  role: UserRole.USER,
  isActive: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeProduct = (overrides: Partial<any> = {}) => ({
  id: "product_test_id",
  sku: "SKU-001",
  name: "Test Product",
  description: "A test product",
  price: 9999,
  categoryId: "cat_1",
  status: ProductStatus.ACTIVE,
  weight: 1,
  brand: null,
  metaTitle: null,
  metaDescription: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { id: "cat_1", name: "Category", slug: "category" },
  images: [],
  variants: [],
  attributeValues: [],
  ...overrides,
});

export const makeOrder = (overrides: Partial<any> = {}) => ({
  id: "order_1",
  userId: 1,
  status: OrderStatus.PENDING,
  shippingAddressId: null,
  shippingAddressSnapshot: {
    street: "1 rue Test",
    city: "Yaoundé",
    country: "CM",
    postalCode: "0000",
  },
  billingAddressId: null,
  billingAddressSnapshot: null,
  shippingMethodId: null,
  paymentMethodId: null,
  notes: null,
  couponCodeId: null,
  totalAmount: 9999,
  discountedAmount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
  payments: [],
  appliedCoupon: null,
  shippingMethod: null,
  statusHistory: [],
  ...overrides,
});

export const makeCoupon = (overrides: Partial<any> = {}) => ({
  id: "coupon_1",
  code: "PROMO10",
  promotionId: "promo_1",
  maxUses: 100,
  usedCount: 0,
  perUserLimit: 1,
  minOrderAmount: null,
  startDate: null,
  endDate: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  promotion: { id: "promo_1", isActive: true, discounts: [] },
  uses: [],
  ...overrides,
});

export const makeProductImage = (overrides: Partial<any> = {}) => ({
  id: "img_1",
  productId: 1,
  variantId: null,
  url: "https://r2.example.com/products/img_1.jpg",
  altText: null,
  position: 0,
  isPrimary: true,
  createdAt: new Date(),
  ...overrides,
});

export const makeWarehouse = (overrides: Partial<any> = {}) => ({
  id: "wh_1",
  name: "Entrepôt Douala",
  location: "Douala",
  capacity: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeInventoryItem = (overrides: Partial<any> = {}) => ({
  id: "inv_1",
  productId: 1,
  variantId: null,
  warehouseId: "wh_1",
  quantity: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
  product: { id: 1, name: "Test Product" },
  warehouse: { id: "wh_1", name: "Entrepôt Douala" },
  variant: null,
  ...overrides,
});
export const makeReview = (overrides: Partial<any> = {}) => ({
  id: "review_1",
  orderItemId: "item_1",
  productId: 1,
  userId: 1,
  rating: 5,
  comment: "Très bon produit",
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 1, username: "johndoe", firstName: "John", lastName: "Doe" },
  ...overrides,
});

export const makeOrderItemForReview = (overrides: Partial<any> = {}) => ({
  id: "item_1",
  productId: 1,
  order: { userId: 1 },
  ...overrides,
});

export const makeLoyaltyTransaction = (overrides: Partial<any> = {}) => ({
  id: "lt_1",
  userId: 1,
  orderId: null,
  points: 100,
  type: "EARNED",
  createdAt: new Date(),
  ...overrides,
});

export const makeBasketItem = (overrides: Partial<any> = {}) => ({
  id: "bi_1",
  basketId: "basket_1",
  productId: 1,
  variantId: null,
  quantity: 2,
  product: { id: 1, name: "Test Product", price: 1000 },
  variant: null,
  ...overrides,
});

export const makeBasket = (overrides: Partial<any> = {}) => ({
  id: "basket_1",
  userId: 1,
  items: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeVariant = (overrides: Partial<any> = {}) => ({
  id: "variant_1",
  productId: "product_test_id",
  sku: "SKU-VAR-1",
  price: 1500,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  attributeValues: [],
  inventory: [],
  images: [],
  ...overrides,
});

export const makeAttributeDefinition = (overrides: Partial<any> = {}) => ({
  id: "attr_1",
  categoryId: "cat_1",
  name: "Couleur",
  slug: "couleur",
  type: "SELECT",
  unit: null,
  isVariant: true,
  isFilterable: true,
  isRequired: false,
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const makeCategory = (overrides: Partial<any> = {}) => ({
  id: "cat_1",
  name: "Électronique",
  slug: "electronique",
  description: null,
  imageUrl: null,
  iconUrl: null,
  metaTitle: null,
  metaDescription: null,
  isActive: true,
  parentId: null,
  parent: null,
  children: [],
  _count: { products: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
