import { prisma } from "../../shared/config/database";
import { CreatePopupDto, UpdatePopupDto } from "./popup.schema";

export const popupRepository = {
  findAll: (query: { isActive?: string; targetType?: string }) =>
    prisma.popup.findMany({
      where: {
        ...(query.isActive !== undefined && {
          isActive: query.isActive === "true",
        }),
        ...(query.targetType && { targetType: query.targetType as any }),
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),

  // isActive + fenêtre de dates respectée (bornes nullables = pas de limite)
  findActiveNow: () => {
    const now = new Date();
    return prisma.popup.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  },

  findById: (id: string) => prisma.popup.findUnique({ where: { id } }),

  create: (data: CreatePopupDto) =>
    prisma.popup.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      } as any,
    }),

  update: (id: string, data: UpdatePopupDto) =>
    prisma.popup.update({
      where: { id },
      data: {
        ...data,
        ...(data.startDate !== undefined && {
          startDate: data.startDate ? new Date(data.startDate) : null,
        }),
        ...(data.endDate !== undefined && {
          endDate: data.endDate ? new Date(data.endDate) : null,
        }),
      } as any,
    }),

  delete: (id: string) => prisma.popup.delete({ where: { id } }),
};
