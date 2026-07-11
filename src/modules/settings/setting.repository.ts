import { prisma } from "../../shared/config/database";
import { SettingType } from "@prisma/client";

export const settingRepository = {
  findAll: (category?: string) =>
    prisma.setting.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: "asc" }, { key: "asc" }],
    }),

  findByKey: (key: string) => prisma.setting.findUnique({ where: { key } }),

  findPublic: () =>
    prisma.setting.findMany({
      where: { isPublic: true },
      orderBy: [{ category: "asc" }, { key: "asc" }],
    }),

  upsert: (key: string, value: string, updatedBy?: number) =>
    prisma.setting.update({
      where: { key },
      data: { value, ...(updatedBy !== undefined && { updatedBy }) },
    }),

  upsertMany: (entries: { key: string; value: string }[], updatedBy?: number) =>
    prisma.$transaction(
      entries.map((e) =>
        prisma.setting.update({
          where: { key: e.key },
          data: {
            value: e.value,
            ...(updatedBy !== undefined && { updatedBy }),
          },
        }),
      ),
    ),

  create: (data: {
    key: string;
    value: string;
    type: SettingType;
    category: string;
    description?: string;
    isPublic?: boolean;
  }) => prisma.setting.create({ data }),
};
