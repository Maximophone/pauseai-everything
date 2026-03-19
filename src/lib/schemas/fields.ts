import { z } from "zod";

const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "select",
  "multiselect",
  "boolean",
  "url",
  "email",
] as const;

export const CreateFieldInput = z.object({
  name: z.string().min(1, "name is required."),
  label: z.string().min(1, "label is required."),
  fieldType: z.enum(FIELD_TYPES, {
    message: `fieldType must be one of: ${FIELD_TYPES.join(", ")}`,
  }),
  options: z.array(z.string()).nullable().optional(),
  required: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type CreateFieldInput = z.infer<typeof CreateFieldInput>;

export const UpdateFieldInput = z.object({
  label: z.string().min(1).optional(),
  fieldType: z.enum(FIELD_TYPES).optional(),
  options: z.array(z.string()).nullable().optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateFieldInput = z.infer<typeof UpdateFieldInput>;
