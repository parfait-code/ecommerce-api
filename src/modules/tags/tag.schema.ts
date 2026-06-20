import { z } from "zod";

export const createTagSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug must be lowercase, alphanumeric and hyphen-separated",
    }),
});

export const updateTagSchema = createTagSchema.partial();

export const setProductTagsSchema = z.object({
  tagIds: z.array(z.string()).min(1),
});

export type CreateTagDto = z.infer<typeof createTagSchema>;
export type UpdateTagDto = z.infer<typeof updateTagSchema>;
export type SetProductTagsDto = z.infer<typeof setProductTagsSchema>;
