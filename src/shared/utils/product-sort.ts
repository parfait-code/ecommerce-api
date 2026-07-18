import { Prisma } from "@prisma/client";

export type ProductSort =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc";

export const parseProductSort = (
  sort?: string,
): Prisma.ProductOrderByWithRelationInput => {
  switch (sort as ProductSort) {
    case "oldest":
      return { createdAt: "asc" };
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    case "name_asc":
      return { name: "asc" };
    case "name_desc":
      return { name: "desc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
};
