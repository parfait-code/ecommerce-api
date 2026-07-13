import { z } from "zod";

export const popupTargetTypeEnum = z.enum([
  "PROMOTION",
  "CATEGORY",
  "PRODUCT",
  "INFO",
  "EXTERNAL_LINK",
]);

export const popupDisplayFrequencyEnum = z.enum([
  "ONCE_PER_SESSION",
  "ONCE_PER_DAY",
  "ALWAYS",
]);

const popupBaseSchema = z.object({
  title: z.string().min(2).max(200),
  imageUrl: z.string().url().optional(),
  message: z.string().optional(),
  isActive: z.boolean().default(true),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  targetType: popupTargetTypeEnum,
  targetId: z.string().optional(),
  externalUrl: z.string().url().optional(),
  ctaLabel: z.string().max(50).optional(),
  displayFrequency: popupDisplayFrequencyEnum.default("ONCE_PER_SESSION"),
  priority: z.number().int().min(0).default(0),
});

// PROMOTION/CATEGORY/PRODUCT exigent targetId, EXTERNAL_LINK exige externalUrl,
// INFO n'exige rien (annonce pure, sans lien).
const hasValidTarget = (data: {
  targetType: string;
  targetId?: string;
  externalUrl?: string;
}) => {
  if (["PROMOTION", "CATEGORY", "PRODUCT"].includes(data.targetType)) {
    return !!data.targetId;
  }
  if (data.targetType === "EXTERNAL_LINK") {
    return !!data.externalUrl;
  }
  return true;
};

const targetRefineMessage = {
  message:
    "targetId is required for PROMOTION/CATEGORY/PRODUCT, externalUrl is required for EXTERNAL_LINK",
  path: ["targetId"],
};

export const createPopupSchema = popupBaseSchema
  .refine(
    (data) =>
      data.startDate && data.endDate
        ? new Date(data.endDate) > new Date(data.startDate)
        : true,
    { message: "endDate must be after startDate", path: ["endDate"] },
  )
  .refine(hasValidTarget, targetRefineMessage);

export const updatePopupSchema = popupBaseSchema
  .partial()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    { message: "endDate must be after startDate", path: ["endDate"] },
  )
  .refine(
    (data) =>
      data.targetType === undefined ? true : hasValidTarget(data as any),
    targetRefineMessage,
  );

export type CreatePopupDto = z.infer<typeof createPopupSchema>;
export type UpdatePopupDto = z.infer<typeof updatePopupSchema>;
