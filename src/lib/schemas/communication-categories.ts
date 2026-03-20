import { z } from "zod";

export const CreateCategoryInput = z.object({
  name: z.string().min(1, "name is required.").regex(/^[a-z0-9-]+$/, "name must be a lowercase slug (letters, numbers, hyphens)."),
  label: z.string().min(1, "label is required."),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInput>;

export const UpdateCategoryInput = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/, "name must be a lowercase slug.").optional(),
  label: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInput>;
