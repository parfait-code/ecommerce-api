import { z } from "zod";

export const updateSettingSchema = z.object({
  value: z.unknown(),
});

export const updateManySettingsSchema = z.object({
  settings: z.array(z.object({ key: z.string(), value: z.unknown() })).min(1),
});

export type UpdateSettingDto = z.infer<typeof updateSettingSchema>;
export type UpdateManySettingsDto = z.infer<typeof updateManySettingsSchema>;
