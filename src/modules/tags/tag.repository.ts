import { prisma } from "../../shared/config/database";
import { CreateTagDto, UpdateTagDto } from "./tag.schema";

export const tagRepository = {
  findAll: () => prisma.tag.findMany({ orderBy: { name: "asc" } }),

  findById: (id: string) =>
    prisma.tag.findUnique({
      where: { id },
      include: { products: { include: { product: true } } },
    }),

  findBySlug: (slug: string) => prisma.tag.findUnique({ where: { slug } }),

  findByName: (name: string) => prisma.tag.findUnique({ where: { name } }),

  create: (data: CreateTagDto) => prisma.tag.create({ data }),

  update: (id: string, data: UpdateTagDto) =>
    prisma.tag.update({ where: { id }, data }),

  delete: (id: string) => prisma.tag.delete({ where: { id } }),

  setProductTags: (productId: string, tagIds: string[]) =>
    prisma.$transaction(async (tx) => {
      await tx.productTag.deleteMany({ where: { productId } });
      if (tagIds.length > 0) {
        await tx.productTag.createMany({
          data: tagIds.map((tagId) => ({ productId, tagId })),
        });
      }
      return tx.product.findUnique({
        where: { id: productId },
        include: { tags: { include: { tag: true } } },
      });
    }),

  findByProduct: (productId: string) =>
    prisma.productTag.findMany({
      where: { productId },
      include: { tag: true },
    }),
};
